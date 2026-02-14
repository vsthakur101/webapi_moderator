import json
import platform
import subprocess
from typing import List, Optional, Dict, Any


class SystemProxyError(RuntimeError):
    pass


def _run_command(command: List[str]) -> str:
    result = subprocess.run(
        command,
        check=False,
        capture_output=True,
        text=True,
    )

    if result.returncode != 0:
        stderr = result.stderr.strip() or result.stdout.strip()
        raise SystemProxyError(stderr or "Failed to run system command")

    return result.stdout.strip()


def _get_macos_services() -> List[str]:
    output = _run_command(["networksetup", "-listallnetworkservices"])
    services: List[str] = []
    for line in output.splitlines():
        line = line.strip()
        if not line or line.startswith("An asterisk") or line.startswith("*"):
            continue
        services.append(line)
    return services


def _parse_networksetup_proxy(output: str) -> Dict[str, Any]:
    data: Dict[str, Any] = {}
    for line in output.splitlines():
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        data[key.strip().lower()] = value.strip()
    return data


def _get_macos_proxy_status() -> Dict[str, Any]:
    services = _get_macos_services()
    enabled = False
    host: Optional[str] = None
    port: Optional[int] = None

    for service in services:
        output = _run_command(["networksetup", "-getwebproxy", service])
        proxy_info = _parse_networksetup_proxy(output)
        if proxy_info.get("enabled", "no").lower() == "yes":
            enabled = True
            host = proxy_info.get("server") or host
            port_value = proxy_info.get("port")
            if port_value and port_value.isdigit():
                port = int(port_value)
            break

    return {
        "supported": True,
        "enabled": enabled,
        "os": "macos",
        "host": host,
        "port": port,
        "bypass": [],
    }


def _set_macos_proxy(host: str, port: int, bypass: List[str]) -> Dict[str, Any]:
    services = _get_macos_services()
    for service in services:
        _run_command(["networksetup", "-setwebproxy", service, host, str(port)])
        _run_command(["networksetup", "-setsecurewebproxy", service, host, str(port)])
        _run_command(["networksetup", "-setwebproxystate", service, "on"])
        _run_command(["networksetup", "-setsecurewebproxystate", service, "on"])
        if bypass:
            _run_command(["networksetup", "-setproxybypassdomains", service, *bypass])

    return {
        "supported": True,
        "enabled": True,
        "os": "macos",
        "host": host,
        "port": port,
        "bypass": bypass,
    }


def _disable_macos_proxy() -> Dict[str, Any]:
    services = _get_macos_services()
    for service in services:
        _run_command(["networksetup", "-setwebproxystate", service, "off"])
        _run_command(["networksetup", "-setsecurewebproxystate", service, "off"])

    return {
        "supported": True,
        "enabled": False,
        "os": "macos",
        "host": None,
        "port": None,
        "bypass": [],
    }


def _run_powershell(command: str) -> str:
    return _run_command([
        "powershell",
        "-NoProfile",
        "-Command",
        command,
    ])


def _get_windows_proxy_status() -> Dict[str, Any]:
    script = (
        "$path='HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings';"
        "$props=Get-ItemProperty -Path $path -Name ProxyEnable,ProxyServer,ProxyOverride -ErrorAction SilentlyContinue;"
        "$enabled=($props.ProxyEnable -eq 1);"
        "[pscustomobject]@{enabled=$enabled;proxy=$props.ProxyServer;bypass=$props.ProxyOverride} | ConvertTo-Json -Compress"
    )

    output = _run_powershell(script)
    data = json.loads(output or "{}")
    proxy = data.get("proxy") or None
    host = None
    port = None
    if proxy and ":" in proxy:
        host, port_value = proxy.split(":", 1)
        if port_value.isdigit():
            port = int(port_value)

    bypass_raw = data.get("bypass") or ""
    bypass = [entry for entry in bypass_raw.split(";") if entry]

    return {
        "supported": True,
        "enabled": bool(data.get("enabled")),
        "os": "windows",
        "host": host,
        "port": port,
        "bypass": bypass,
    }


def _set_windows_proxy(host: str, port: int, bypass: List[str]) -> Dict[str, Any]:
    bypass_value = ";".join(bypass) if bypass else ""
    script = (
        "$path='HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings';"
        f"Set-ItemProperty -Path $path -Name ProxyEnable -Value 1;"
        f"Set-ItemProperty -Path $path -Name ProxyServer -Value '{host}:{port}';"
        f"Set-ItemProperty -Path $path -Name ProxyOverride -Value '{bypass_value}';"
    )
    _run_powershell(script)

    return {
        "supported": True,
        "enabled": True,
        "os": "windows",
        "host": host,
        "port": port,
        "bypass": bypass,
    }


def _disable_windows_proxy() -> Dict[str, Any]:
    script = (
        "$path='HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings';"
        "Set-ItemProperty -Path $path -Name ProxyEnable -Value 0;"
    )
    _run_powershell(script)

    return {
        "supported": True,
        "enabled": False,
        "os": "windows",
        "host": None,
        "port": None,
        "bypass": [],
    }


def get_system_proxy_status() -> Dict[str, Any]:
    system = platform.system().lower()
    if system == "darwin":
        return _get_macos_proxy_status()
    if system == "windows":
        return _get_windows_proxy_status()

    return {
        "supported": False,
        "enabled": False,
        "os": system,
        "host": None,
        "port": None,
        "bypass": [],
        "message": "Unsupported OS for system proxy management.",
    }


def enable_system_proxy(host: str, port: int, bypass: Optional[List[str]] = None) -> Dict[str, Any]:
    system = platform.system().lower()
    bypass_list = bypass or []
    if system == "darwin":
        return _set_macos_proxy(host, port, bypass_list)
    if system == "windows":
        return _set_windows_proxy(host, port, bypass_list)

    raise SystemProxyError("Unsupported OS for system proxy management.")


def disable_system_proxy() -> Dict[str, Any]:
    system = platform.system().lower()
    if system == "darwin":
        return _disable_macos_proxy()
    if system == "windows":
        return _disable_windows_proxy()

    raise SystemProxyError("Unsupported OS for system proxy management.")
