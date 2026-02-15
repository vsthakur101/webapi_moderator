from datetime import datetime
from urllib.parse import urlparse, parse_qs

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.target import Target, SiteMapNode
from app.models.request import Request
from app.schemas.target import (
    TargetResponse,
    TargetUpdate,
    SiteMapNodeResponse,
    SiteMapTreeNode,
)

router = APIRouter()


def get_path_segments(path: str) -> list[str]:
    """Split a path into segments."""
    # Remove query string
    path = path.split("?")[0]
    # Split and filter empty segments
    segments = [s for s in path.split("/") if s]
    return segments


def build_tree(nodes: list[SiteMapNode], host: str) -> list[SiteMapTreeNode]:
    """Build a hierarchical tree from flat site map nodes."""
    # Group nodes by path
    path_nodes: dict[str, SiteMapNode] = {node.path: node for node in nodes}

    # Build tree structure
    root_children: dict[str, SiteMapTreeNode] = {}

    for node in nodes:
        segments = get_path_segments(node.path)
        if not segments:
            # Root path
            if "/" not in root_children:
                root_children["/"] = SiteMapTreeNode(
                    name="/",
                    path="/",
                    node_type="folder",
                    methods=node.methods or [],
                    status_codes=node.status_codes or [],
                    request_count=node.request_count,
                    children=[],
                )
            else:
                # Update existing root
                root = root_children["/"]
                for method in (node.methods or []):
                    if method not in root.methods:
                        root.methods.append(method)
                for status in (node.status_codes or []):
                    if status not in root.status_codes:
                        root.status_codes.append(status)
                root.request_count += node.request_count
            continue

        # Build path hierarchy
        current_level = root_children
        current_path = ""

        for i, segment in enumerate(segments):
            current_path = current_path + "/" + segment
            is_last = i == len(segments) - 1

            if segment not in current_level:
                tree_node = SiteMapTreeNode(
                    name=segment,
                    path=current_path,
                    node_type="file" if is_last else "folder",
                    methods=node.methods if is_last else [],
                    status_codes=node.status_codes if is_last else [],
                    request_count=node.request_count if is_last else 0,
                    children=[],
                )
                current_level[segment] = tree_node
            else:
                # Update existing node
                if is_last:
                    existing = current_level[segment]
                    for method in (node.methods or []):
                        if method not in existing.methods:
                            existing.methods.append(method)
                    for status in (node.status_codes or []):
                        if status not in existing.status_codes:
                            existing.status_codes.append(status)
                    existing.request_count += node.request_count

            if not is_last:
                # Navigate to children dict
                parent = current_level[segment]
                # Convert children list to dict for easier lookup
                children_dict = {c.name: c for c in parent.children}
                current_level = children_dict
                # After processing, convert back to list
                parent.children = list(children_dict.values())

    # Convert root dict to list
    return list(root_children.values())


@router.get("/", response_model=list[TargetResponse])
async def list_targets(db: AsyncSession = Depends(get_db)):
    """List all discovered targets."""
    result = await db.execute(
        select(Target).order_by(Target.last_seen.desc())
    )
    targets = result.scalars().all()

    return [
        TargetResponse(
            id=target.id,
            host=target.host,
            in_scope=target.in_scope,
            notes=target.notes,
            request_count=target.request_count,
            first_seen=target.first_seen,
            last_seen=target.last_seen,
        )
        for target in targets
    ]


@router.get("/{target_id}", response_model=TargetResponse)
async def get_target(target_id: str, db: AsyncSession = Depends(get_db)):
    """Get a specific target."""
    result = await db.execute(
        select(Target).where(Target.id == target_id)
    )
    target = result.scalar_one_or_none()

    if not target:
        raise HTTPException(status_code=404, detail="Target not found")

    return TargetResponse(
        id=target.id,
        host=target.host,
        in_scope=target.in_scope,
        notes=target.notes,
        request_count=target.request_count,
        first_seen=target.first_seen,
        last_seen=target.last_seen,
    )


@router.patch("/{target_id}", response_model=TargetResponse)
async def update_target(
    target_id: str,
    target_update: TargetUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update a target (scope, notes)."""
    result = await db.execute(
        select(Target).where(Target.id == target_id)
    )
    target = result.scalar_one_or_none()

    if not target:
        raise HTTPException(status_code=404, detail="Target not found")

    update_data = target_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(target, key, value)

    await db.commit()
    await db.refresh(target)

    return TargetResponse(
        id=target.id,
        host=target.host,
        in_scope=target.in_scope,
        notes=target.notes,
        request_count=target.request_count,
        first_seen=target.first_seen,
        last_seen=target.last_seen,
    )


@router.delete("/{target_id}")
async def delete_target(target_id: str, db: AsyncSession = Depends(get_db)):
    """Delete a target and its site map nodes."""
    result = await db.execute(
        select(Target).where(Target.id == target_id)
    )
    target = result.scalar_one_or_none()

    if not target:
        raise HTTPException(status_code=404, detail="Target not found")

    await db.delete(target)
    await db.commit()

    return {"message": "Target deleted"}


@router.get("/{target_id}/sitemap", response_model=list[SiteMapTreeNode])
async def get_sitemap(target_id: str, db: AsyncSession = Depends(get_db)):
    """Get site map tree for a target."""
    result = await db.execute(
        select(Target).where(Target.id == target_id).options(selectinload(Target.nodes))
    )
    target = result.scalar_one_or_none()

    if not target:
        raise HTTPException(status_code=404, detail="Target not found")

    return build_tree(target.nodes, target.host)


@router.get("/{target_id}/sitemap/flat", response_model=list[SiteMapNodeResponse])
async def get_sitemap_flat(target_id: str, db: AsyncSession = Depends(get_db)):
    """Get flat list of site map nodes."""
    result = await db.execute(
        select(SiteMapNode)
        .where(SiteMapNode.target_id == target_id)
        .order_by(SiteMapNode.path)
    )
    nodes = result.scalars().all()

    return [
        SiteMapNodeResponse(
            id=node.id,
            target_id=node.target_id,
            path=node.path,
            parent_path=node.parent_path,
            node_type=node.node_type,
            methods=node.methods or [],
            status_codes=node.status_codes or [],
            content_types=node.content_types or [],
            parameters=node.parameters or [],
            request_count=node.request_count,
            first_seen=node.first_seen,
            last_seen=node.last_seen,
        )
        for node in nodes
    ]


@router.post("/rebuild")
async def rebuild_sitemap(db: AsyncSession = Depends(get_db)):
    """Rebuild site maps from request history."""
    # Get all requests
    result = await db.execute(select(Request))
    requests = result.scalars().all()

    # Track targets and nodes
    targets_map: dict[str, Target] = {}
    nodes_map: dict[str, dict[str, SiteMapNode]] = {}  # host -> path -> node

    for req in requests:
        host = req.host
        path = req.path.split("?")[0]  # Remove query string
        method = req.method
        status = req.response_status
        content_type = req.response_content_type

        # Get or create target
        if host not in targets_map:
            # Check if target exists in DB
            existing = await db.execute(
                select(Target).where(Target.host == host)
            )
            target = existing.scalar_one_or_none()
            if not target:
                target = Target(host=host, request_count=0)
                db.add(target)
            targets_map[host] = target
            nodes_map[host] = {}

        target = targets_map[host]
        target.request_count += 1
        target.last_seen = max(target.last_seen, req.timestamp)
        target.first_seen = min(target.first_seen, req.timestamp)

        # Get or create site map node
        if path not in nodes_map[host]:
            # Check if node exists in DB
            existing = await db.execute(
                select(SiteMapNode).where(
                    SiteMapNode.target_id == target.id,
                    SiteMapNode.path == path,
                )
            )
            node = existing.scalar_one_or_none()
            if not node:
                # Determine parent path
                segments = get_path_segments(path)
                parent_path = "/" + "/".join(segments[:-1]) if len(segments) > 1 else None

                node = SiteMapNode(
                    target_id=target.id,
                    path=path,
                    parent_path=parent_path,
                    node_type="file",
                    methods=[],
                    status_codes=[],
                    content_types=[],
                    parameters=[],
                    request_count=0,
                )
                db.add(node)
            nodes_map[host][path] = node

        node = nodes_map[host][path]
        node.request_count += 1
        node.last_seen = max(node.last_seen, req.timestamp)
        node.first_seen = min(node.first_seen, req.timestamp)

        # Update methods
        if method and method not in (node.methods or []):
            node.methods = (node.methods or []) + [method]

        # Update status codes
        if status and status not in (node.status_codes or []):
            node.status_codes = (node.status_codes or []) + [status]

        # Update content types
        if content_type and content_type not in (node.content_types or []):
            node.content_types = (node.content_types or []) + [content_type]

        # Extract query parameters
        if "?" in req.path:
            query_string = req.path.split("?", 1)[1]
            params = parse_qs(query_string)
            for param in params.keys():
                if param not in (node.parameters or []):
                    node.parameters = (node.parameters or []) + [param]

    await db.commit()

    return {
        "message": "Site map rebuilt",
        "targets": len(targets_map),
        "nodes": sum(len(nodes) for nodes in nodes_map.values()),
    }
