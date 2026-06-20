from app.core.abc import classify_abc


def test_abc_basic_split():
    contributions = {
        "A1": 700,
        "A2": 120,
        "B1": 100,
        "C1": 50,
        "C2": 30,
    }
    result = classify_abc(contributions, a_pct=0.80, b_pct=0.15)
    assert result["A1"] == "A"
    assert result["C2"] == "C"
    # total = 1000; A1 = 0.70 (A), +A2 0.12 -> 0.82 (B), B1 0.10 -> 0.92 (B), resto C
    assert result["A2"] == "B"


def test_abc_empty():
    assert classify_abc({}) == {}


def test_abc_zero_total_all_c():
    assert classify_abc({"x": 0, "y": 0}) == {"x": "C", "y": "C"}
