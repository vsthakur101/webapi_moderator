from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.sequencer import SequencerAnalysis
from app.sequencer import analyze_tokens
from app.schemas.sequencer import (
    AnalysisCreate,
    AnalysisUpdate,
    AnalysisResponse,
    AnalysisDetailResponse,
    ManualAnalyzeRequest,
)

router = APIRouter()


@router.get("/analyses", response_model=list[AnalysisResponse])
async def list_analyses(db: AsyncSession = Depends(get_db)):
    """List all sequencer analyses."""
    result = await db.execute(
        select(SequencerAnalysis).order_by(SequencerAnalysis.created_at.desc())
    )
    analyses = result.scalars().all()

    return [
        AnalysisResponse(
            id=a.id,
            name=a.name,
            status=a.status,
            source_request_id=a.source_request_id,
            extraction_type=a.extraction_type,
            extraction_pattern=a.extraction_pattern,
            sample_count=a.sample_count,
            collected_count=a.collected_count,
            error_message=a.error_message,
            created_at=a.created_at,
            started_at=a.started_at,
            completed_at=a.completed_at,
        )
        for a in analyses
    ]


@router.post("/analyses", response_model=AnalysisResponse)
async def create_analysis(
    analysis: AnalysisCreate, db: AsyncSession = Depends(get_db)
):
    """Create a new sequencer analysis."""
    db_analysis = SequencerAnalysis(
        name=analysis.name,
        source_request_id=analysis.source_request_id,
        extraction_type=analysis.extraction_type,
        extraction_pattern=analysis.extraction_pattern,
        sample_count=analysis.sample_count,
    )

    db.add(db_analysis)
    await db.commit()
    await db.refresh(db_analysis)

    return AnalysisResponse(
        id=db_analysis.id,
        name=db_analysis.name,
        status=db_analysis.status,
        source_request_id=db_analysis.source_request_id,
        extraction_type=db_analysis.extraction_type,
        extraction_pattern=db_analysis.extraction_pattern,
        sample_count=db_analysis.sample_count,
        collected_count=db_analysis.collected_count,
        error_message=db_analysis.error_message,
        created_at=db_analysis.created_at,
        started_at=db_analysis.started_at,
        completed_at=db_analysis.completed_at,
    )


@router.get("/analyses/{analysis_id}", response_model=AnalysisDetailResponse)
async def get_analysis(analysis_id: str, db: AsyncSession = Depends(get_db)):
    """Get analysis details including samples and results."""
    result = await db.execute(
        select(SequencerAnalysis).where(SequencerAnalysis.id == analysis_id)
    )
    analysis = result.scalar_one_or_none()

    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    return AnalysisDetailResponse(
        id=analysis.id,
        name=analysis.name,
        status=analysis.status,
        source_request_id=analysis.source_request_id,
        extraction_type=analysis.extraction_type,
        extraction_pattern=analysis.extraction_pattern,
        sample_count=analysis.sample_count,
        collected_count=analysis.collected_count,
        error_message=analysis.error_message,
        created_at=analysis.created_at,
        started_at=analysis.started_at,
        completed_at=analysis.completed_at,
        samples=analysis.samples or [],
        analysis_results=analysis.analysis_results,
    )


@router.patch("/analyses/{analysis_id}", response_model=AnalysisResponse)
async def update_analysis(
    analysis_id: str,
    analysis_update: AnalysisUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update an analysis configuration."""
    result = await db.execute(
        select(SequencerAnalysis).where(SequencerAnalysis.id == analysis_id)
    )
    analysis = result.scalar_one_or_none()

    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    if analysis.status in ["collecting", "analyzing"]:
        raise HTTPException(status_code=400, detail="Cannot modify active analysis")

    update_data = analysis_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(analysis, key, value)

    await db.commit()
    await db.refresh(analysis)

    return AnalysisResponse(
        id=analysis.id,
        name=analysis.name,
        status=analysis.status,
        source_request_id=analysis.source_request_id,
        extraction_type=analysis.extraction_type,
        extraction_pattern=analysis.extraction_pattern,
        sample_count=analysis.sample_count,
        collected_count=analysis.collected_count,
        error_message=analysis.error_message,
        created_at=analysis.created_at,
        started_at=analysis.started_at,
        completed_at=analysis.completed_at,
    )


@router.delete("/analyses/{analysis_id}")
async def delete_analysis(analysis_id: str, db: AsyncSession = Depends(get_db)):
    """Delete an analysis."""
    result = await db.execute(
        select(SequencerAnalysis).where(SequencerAnalysis.id == analysis_id)
    )
    analysis = result.scalar_one_or_none()

    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    await db.delete(analysis)
    await db.commit()

    return {"message": "Analysis deleted"}


@router.post("/analyses/{analysis_id}/add-sample")
async def add_sample(
    analysis_id: str,
    sample: str,
    db: AsyncSession = Depends(get_db),
):
    """Add a sample token to an analysis."""
    result = await db.execute(
        select(SequencerAnalysis).where(SequencerAnalysis.id == analysis_id)
    )
    analysis = result.scalar_one_or_none()

    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    # Add sample
    samples = analysis.samples or []
    samples.append(sample)
    analysis.samples = samples
    analysis.collected_count = len(samples)

    if analysis.status == "configured":
        analysis.status = "collecting"
        analysis.started_at = datetime.utcnow()

    await db.commit()

    return {
        "message": "Sample added",
        "collected_count": analysis.collected_count,
        "sample_count": analysis.sample_count,
    }


@router.post("/analyses/{analysis_id}/add-samples")
async def add_samples(
    analysis_id: str,
    samples: list[str],
    db: AsyncSession = Depends(get_db),
):
    """Add multiple sample tokens to an analysis."""
    result = await db.execute(
        select(SequencerAnalysis).where(SequencerAnalysis.id == analysis_id)
    )
    analysis = result.scalar_one_or_none()

    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    # Add samples
    existing_samples = analysis.samples or []
    existing_samples.extend(samples)
    analysis.samples = existing_samples
    analysis.collected_count = len(existing_samples)

    if analysis.status == "configured":
        analysis.status = "collecting"
        analysis.started_at = datetime.utcnow()

    await db.commit()

    return {
        "message": f"Added {len(samples)} samples",
        "collected_count": analysis.collected_count,
        "sample_count": analysis.sample_count,
    }


@router.post("/analyses/{analysis_id}/analyze")
async def run_analysis(analysis_id: str, db: AsyncSession = Depends(get_db)):
    """Run statistical analysis on collected samples."""
    result = await db.execute(
        select(SequencerAnalysis).where(SequencerAnalysis.id == analysis_id)
    )
    analysis = result.scalar_one_or_none()

    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    if not analysis.samples or len(analysis.samples) == 0:
        raise HTTPException(status_code=400, detail="No samples collected")

    try:
        analysis.status = "analyzing"
        await db.commit()

        # Run analysis
        results = analyze_tokens(analysis.samples)

        analysis.analysis_results = results
        analysis.status = "completed"
        analysis.completed_at = datetime.utcnow()
        await db.commit()

        return results

    except Exception as e:
        analysis.status = "error"
        analysis.error_message = str(e)
        await db.commit()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analyses/{analysis_id}/reset")
async def reset_analysis(analysis_id: str, db: AsyncSession = Depends(get_db)):
    """Reset an analysis to start fresh."""
    result = await db.execute(
        select(SequencerAnalysis).where(SequencerAnalysis.id == analysis_id)
    )
    analysis = result.scalar_one_or_none()

    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    analysis.status = "configured"
    analysis.samples = []
    analysis.collected_count = 0
    analysis.analysis_results = None
    analysis.error_message = None
    analysis.started_at = None
    analysis.completed_at = None

    await db.commit()

    return {"message": "Analysis reset"}


@router.post("/analyze-manual")
async def analyze_manual(request: ManualAnalyzeRequest):
    """Analyze manually provided tokens without saving."""
    if not request.tokens or len(request.tokens) == 0:
        raise HTTPException(status_code=400, detail="No tokens provided")

    results = analyze_tokens(request.tokens)
    return results
