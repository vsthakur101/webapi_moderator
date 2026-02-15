import math
from collections import Counter
from typing import Optional


def calculate_entropy(data: str) -> float:
    """Calculate Shannon entropy of a string."""
    if not data:
        return 0.0

    # Count character frequencies
    freq = Counter(data)
    length = len(data)

    # Calculate entropy
    entropy = 0.0
    for count in freq.values():
        if count > 0:
            p = count / length
            entropy -= p * math.log2(p)

    return entropy


def calculate_max_entropy(charset_size: int, length: int) -> float:
    """Calculate maximum possible entropy for given charset and length."""
    if charset_size <= 0 or length <= 0:
        return 0.0
    return math.log2(charset_size) * length


def detect_sequential_patterns(tokens: list[str]) -> bool:
    """Detect if tokens contain sequential patterns (e.g., 1, 2, 3...)."""
    if len(tokens) < 3:
        return False

    # Try to detect numeric sequences
    try:
        # Check if tokens are numeric and sequential
        nums = [int(t) for t in tokens[:10]]
        diffs = [nums[i + 1] - nums[i] for i in range(len(nums) - 1)]
        if len(set(diffs)) == 1:  # All differences are the same
            return True
    except (ValueError, TypeError):
        pass

    # Check for alphabetic sequences
    if all(len(t) == 1 and t.isalpha() for t in tokens[:10]):
        ords = [ord(t) for t in tokens[:10]]
        diffs = [ords[i + 1] - ords[i] for i in range(len(ords) - 1)]
        if len(set(diffs)) == 1:
            return True

    return False


def detect_repeated_patterns(tokens: list[str]) -> bool:
    """Detect if tokens contain repeated values."""
    if len(tokens) < 2:
        return False

    # Check for exact duplicates
    unique = set(tokens)
    if len(unique) < len(tokens) * 0.9:  # More than 10% duplicates
        return True

    return False


def find_common_affixes(tokens: list[str], affix_type: str = "prefix") -> list[str]:
    """Find common prefixes or suffixes in tokens."""
    if not tokens:
        return []

    affixes = Counter()

    for token in tokens:
        if len(token) < 3:
            continue

        if affix_type == "prefix":
            # Check prefixes of length 2-5
            for length in range(2, min(6, len(token))):
                affixes[token[:length]] += 1
        else:
            # Check suffixes of length 2-5
            for length in range(2, min(6, len(token))):
                affixes[token[-length:]] += 1

    # Return affixes that appear in more than 50% of tokens
    threshold = len(tokens) * 0.5
    common = [affix for affix, count in affixes.items() if count >= threshold]

    return sorted(common, key=len, reverse=True)[:5]


def get_entropy_rating(efficiency: float) -> str:
    """Get a human-readable rating for entropy efficiency."""
    if efficiency >= 0.9:
        return "Excellent"
    elif efficiency >= 0.7:
        return "Good"
    elif efficiency >= 0.5:
        return "Fair"
    else:
        return "Poor"


def get_recommendation(
    entropy_efficiency: float,
    has_sequential: bool,
    has_repeated: bool,
    unique_ratio: float,
) -> str:
    """Generate a security recommendation based on analysis."""
    issues = []

    if entropy_efficiency < 0.5:
        issues.append("Low entropy indicates predictable token generation")

    if has_sequential:
        issues.append("Sequential patterns detected - tokens may be guessable")

    if has_repeated:
        issues.append("Repeated tokens found - possible collision risk")

    if unique_ratio < 0.95:
        issues.append("High duplicate rate suggests weak randomness")

    if not issues:
        return "Token generation appears to be cryptographically secure with good randomness."

    return "Security concerns: " + "; ".join(issues) + ". Consider using a cryptographically secure random number generator."


def analyze_tokens(tokens: list[str]) -> dict:
    """Perform comprehensive analysis on a list of tokens."""
    if not tokens:
        return {
            "total_samples": 0,
            "unique_samples": 0,
            "min_length": 0,
            "max_length": 0,
            "avg_length": 0,
            "character_set": [],
            "character_frequencies": [],
            "entropy": {
                "entropy_bits": 0,
                "max_entropy": 0,
                "efficiency": 0,
                "rating": "N/A",
            },
            "patterns": {
                "has_sequential": False,
                "has_repeated": False,
                "common_prefixes": [],
                "common_suffixes": [],
            },
            "recommendation": "No tokens provided for analysis.",
        }

    # Basic statistics
    total_samples = len(tokens)
    unique_samples = len(set(tokens))
    lengths = [len(t) for t in tokens]
    min_length = min(lengths)
    max_length = max(lengths)
    avg_length = sum(lengths) / len(lengths)

    # Character analysis
    all_chars = "".join(tokens)
    char_counter = Counter(all_chars)
    character_set = sorted(set(all_chars))
    total_chars = len(all_chars)

    character_frequencies = [
        {
            "character": char if char.isprintable() else f"\\x{ord(char):02x}",
            "count": count,
            "percentage": round(count / total_chars * 100, 2),
        }
        for char, count in char_counter.most_common(20)
    ]

    # Entropy calculation
    # Calculate average entropy per token
    token_entropies = [calculate_entropy(t) for t in tokens]
    avg_entropy = sum(token_entropies) / len(token_entropies) if token_entropies else 0

    # Calculate theoretical maximum entropy
    charset_size = len(character_set)
    avg_len = int(avg_length)
    max_entropy = math.log2(charset_size) if charset_size > 1 else 0

    # Efficiency is how close we are to maximum entropy
    efficiency = avg_entropy / max_entropy if max_entropy > 0 else 0

    entropy_result = {
        "entropy_bits": round(avg_entropy, 4),
        "max_entropy": round(max_entropy, 4),
        "efficiency": round(efficiency, 4),
        "rating": get_entropy_rating(efficiency),
    }

    # Pattern detection
    has_sequential = detect_sequential_patterns(tokens)
    has_repeated = detect_repeated_patterns(tokens)
    common_prefixes = find_common_affixes(tokens, "prefix")
    common_suffixes = find_common_affixes(tokens, "suffix")

    patterns = {
        "has_sequential": has_sequential,
        "has_repeated": has_repeated,
        "common_prefixes": common_prefixes,
        "common_suffixes": common_suffixes,
    }

    # Generate recommendation
    unique_ratio = unique_samples / total_samples if total_samples > 0 else 0
    recommendation = get_recommendation(
        efficiency, has_sequential, has_repeated, unique_ratio
    )

    return {
        "total_samples": total_samples,
        "unique_samples": unique_samples,
        "min_length": min_length,
        "max_length": max_length,
        "avg_length": round(avg_length, 2),
        "character_set": character_set,
        "character_frequencies": character_frequencies,
        "entropy": entropy_result,
        "patterns": patterns,
        "recommendation": recommendation,
    }
