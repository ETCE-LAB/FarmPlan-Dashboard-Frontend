"""
strata_optimizer.py  —  Syntropic Agroforestry Strata Rules
============================================================
This module defines the strata ordering and species grouping rules
used by end_to_end.py for syntropic treeline placement.

The professor's layout (from Excel):
  TREELINE columns (vertical):
    - Emergent/High canopy trees  (8-12m spacing along row)
    - Medium trees                (4-6m spacing along row)
    - Shrub layer                 (1.5m spacing along row)

  ALLEY columns (between treelines):
    - Climbers/Trellis plants     (1m spacing)
    - Tall herbs / Herbs          (0.5m spacing)
    - Groundcover                 (0.3m spacing)

Spacing is enforced in 2D (Euclidean distance) between ALL plants,
not just within the same row.
"""

from __future__ import annotations
from typing import Dict, List

# ─── Strata order (top of canopy → ground level) ────────────────────────────

STRATA_ORDER: List[str] = [
    "Emergent canopy",
    "High canopy",
    "Medium/High tree",
    "Medium tree",
    "Low/medium tree",
    "Low tree",
    "Shrub layer",
    "Climber/liana",
    "Tall herb geophyte",
    "Herb geophyte",
    "Tall herb",
    "Herb",
    "Groundcover",
    "Tall emergent wetland",
    "Herb aquatic",
    "Wetland herb geophyte",
    "Aquatic rhizome",
]

# ─── Minimum spacing rules per strata (metres) ──────────────────────────────
# Used as fallback when species CSV doesn't specify spacing.
# Values match syntropic agroforestry guidelines for a 0.21 ha field.

SPACING_RULES: Dict[str, float] = {
    "Emergent canopy":      12.0,
    "High canopy":           8.0,
    "Medium/High tree":      6.0,
    "Medium tree":           5.0,
    "Low/medium tree":       4.0,
    "Low tree":              3.0,
    "Shrub layer":           1.5,
    "Climber/liana":         1.0,
    "Tall herb geophyte":    0.5,
    "Herb geophyte":         0.5,
    "Tall herb":             0.5,
    "Herb":                  0.5,
    "Groundcover":           0.3,
    "Tall emergent wetland": 1.0,
    "Herb aquatic":          0.5,
    "Wetland herb geophyte": 0.5,
    "Aquatic rhizome":       0.5,
}

# ─── Treeline type → strata groups ──────────────────────────────────────────

TREELINE_STRATA: Dict[str, List[str]] = {
    "canopy": [
        "Emergent canopy",
        "High canopy",
        "Medium/High tree",
    ],
    "medium": [
        "Medium tree",
        "Low/medium tree",
        "Low tree",
    ],
    "shrub": [
        "Shrub layer",
    ],
    "alley": [
        "Climber/liana",
        "Tall herb",
        "Tall herb geophyte",
        "Herb geophyte",
        "Herb",
        "Groundcover",
    ],
}

# ─── Alley widths per adjacent treeline type ────────────────────────────────
# Canopy trees need wide alleys for light penetration.
# Shrubs can have narrow alleys.

ALLEY_WIDTH_BY_NEIGHBOUR: Dict[str, float] = {
    "canopy": 3.5,   # wide alley beside canopy trees
    "medium": 2.5,   # medium alley beside medium trees
    "shrub":  1.0,   # narrow alley between shrubs
}

# ─── Treeline repeat pattern (x-offsets in metres) ──────────────────────────
# This mirrors the professor's Excel columns.
# Pattern: canopy | wide_alley | medium | medium_alley | shrub | narrow_alley | shrub | ...

TREELINE_PATTERN: List[tuple] = [
    # (type,      x_step_to_next)
    ("canopy",    0.0),   # start at current x
    ("alley",     4.0),   # 4m gap after canopy
    ("medium",    1.5),
    ("alley",     3.0),
    ("shrub",     1.5),
    ("alley",     1.0),
    ("shrub",     1.5),
    ("alley",     1.0),
    ("medium",    1.5),
    ("alley",     3.0),
]

# Width of one full pattern repeat (sum of all x_steps)
PATTERN_REPEAT_M: float = sum(step for _, step in TREELINE_PATTERN[1:])


def get_spacing(strata: str, csv_spacing: float = 0.0) -> float:
    """Return the effective spacing for a plant, preferring CSV value."""
    if csv_spacing and csv_spacing > 0:
        return float(csv_spacing)
    return SPACING_RULES.get(strata.strip(), 1.0)


def strata_to_treeline_type(strata: str) -> str:
    """Map a strata label to the treeline type it belongs in."""
    strata = strata.strip()
    for tl_type, strata_list in TREELINE_STRATA.items():
        if strata in strata_list:
            return tl_type
    return "alley"  # default to alley for unknown strata