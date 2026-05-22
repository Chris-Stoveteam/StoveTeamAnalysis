from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import numpy as np
import scipy.stats as stats
import math
import io

app = FastAPI(title="KPT Analysis API")

# Allow React to communicate with this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, change this to your React app's URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- REFACTORED CALCULATION FUNCTIONS ---

def calculate_kpt_sample_size(df, target_col, confidence_level, precision):
    mean_val = df[target_col].mean()
    sd_val = df[target_col].std()
    
    if mean_val == 0:
        raise ValueError("Mean of the target column is zero, cannot calculate COV.")
    
    cov = sd_val / mean_val
    alpha = 1 - confidence_level
    z_score = stats.norm.ppf(1 - alpha / 2)
    n_required = math.ceil((z_score * cov / precision)**2)
    
    return {
        "mean": round(mean_val, 2),
        "sd": round(sd_val, 2),
        "cov": round(cov, 4),
        "z_score": round(z_score, 3),
        "required_sample_size": n_required
    }

def calculate_kpt_confidence(data_series, confidence_level, target_margin_percent):
    n = len(data_series)
    mean_val = np.mean(data_series)
    std_val = np.std(data_series, ddof=1)
    
    alpha = 1 - confidence_level
    t_crit = stats.t.ppf(1 - (alpha / 2), df=n - 1)
    margin_of_error = t_crit * (std_val / np.sqrt(n))
    relative_moe = margin_of_error / mean_val
    meets_criteria = relative_moe <= target_margin_percent
    
    return {
        "sample_size": n,
        "mean": round(mean_val, 4),
        "std_dev": round(std_val, 4),
        "absolute_moe": round(margin_of_error, 4),
        "relative_moe_percent": round(relative_moe * 100, 2),
        "meets_criteria": bool(meets_criteria)
    }

# NEW: Calculate absolute and percentage change
def calculate_change(group_a, group_b):
    mean_a = np.mean(group_a)
    mean_b = np.mean(group_b)
    
    absolute_change = mean_b - mean_a
    # Handle division by zero
    if mean_a == 0:
        percent_change = np.nan 
    else:
        percent_change = (absolute_change / mean_a) * 100

    return {
        "baseline_mean": round(mean_a, 4),
        "newstove_mean": round(mean_b, 4),
        "absolute_change": round(absolute_change, 4),
        "percentage_change": round(percent_change, 2) if not math.isnan(percent_change) else None
    }

# NEW: Calculate statistical significance
def test_significance(group_a, group_b, paired=False, alpha=0.05):
    group_a = pd.Series(group_a).dropna()
    group_b = pd.Series(group_b).dropna()
    
    if paired:
        stat, p_value = stats.ttest_rel(group_a, group_b)
        test_type = "Paired T-Test"
    else:
        stat, p_value = stats.ttest_ind(group_a, group_b, equal_var=False)
        test_type = "Independent T-Test (Welch's)"
        
    is_significant = p_value < alpha
    
    return {
        "test_type": test_type,
        "t_statistic": round(float(stat), 4),
        "p_value": round(float(p_value), 4),
        "alpha_level": alpha,
        "is_significant": bool(is_significant)
    }


# --- API ENDPOINTS ---

@app.post("/api/single-analysis")
async def run_single_analysis(
    file: UploadFile = File(...),
    target_column: str = Form("Dry_Wood_Per_Cap"),
    confidence_level: float = Form(0.90),
    precision: float = Form(0.10)
):
    try:
        contents = await file.read()
        df = pd.read_csv(io.BytesIO(contents))
        
        if target_column not in df.columns:
            raise HTTPException(status_code=400, detail=f"Column '{target_column}' not found in CSV.")

        sample_size_data = calculate_kpt_sample_size(df, target_column, confidence_level, precision)
        confidence_data = calculate_kpt_confidence(df[target_column], confidence_level, precision)

        return {
            "filename": file.filename,
            "sample_size_analysis": sample_size_data,
            "confidence_analysis": confidence_data
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/comparison-analysis")
async def run_comparison_analysis(
    baseline_file: UploadFile = File(...),
    newstove_file: UploadFile = File(...),
    target_column: str = Form("Dry_Wood_Per_Cap"),
    confidence_level: float = Form(0.90),
    precision: float = Form(0.10),
    paired: bool = Form(False), # Defaults to Independent T-Test (Welch's)
    alpha: float = Form(0.05)
):
    try:
        # 1. Read the baseline file into memory
        baseline_contents = await baseline_file.read()
        baseline_df = pd.read_csv(io.BytesIO(baseline_contents))
        
        # 2. Read the new stove file into memory
        newstove_contents = await newstove_file.read()
        newstove_df = pd.read_csv(io.BytesIO(newstove_contents))
        
        # 3. Validate columns
        if target_column not in baseline_df.columns:
            raise HTTPException(status_code=400, detail=f"Column '{target_column}' not found in Baseline CSV.")
        if target_column not in newstove_df.columns:
            raise HTTPException(status_code=400, detail=f"Column '{target_column}' not found in New Stove CSV.")

        # 4. Run baseline health/confidence checks (similar to the original script)
        baseline_sample_size_data = calculate_kpt_sample_size(baseline_df, target_column, confidence_level, precision)
        baseline_confidence_data = calculate_kpt_confidence(baseline_df[target_column], confidence_level, precision)

        # 5. Run comparison calculations
        change_data = calculate_change(baseline_df[target_column], newstove_df[target_column])
        significance_data = test_significance(
            baseline_df[target_column], 
            newstove_df[target_column], 
            paired=paired, 
            alpha=alpha
        )

        # 6. Return the combined JSON payload
        return {
            "baseline_filename": baseline_file.filename,
            "newstove_filename": newstove_file.filename,
            "baseline_health": {
                "sample_size_analysis": baseline_sample_size_data,
                "confidence_analysis": baseline_confidence_data
            },
            "comparison_results": {
                "change_analysis": change_data,
                "significance_analysis": significance_data
            }
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- SENSOR CSV PARSER ---

def parse_sensor_csv(contents: bytes):
    text = contents.decode("utf-8", errors="replace")
    lines = text.splitlines()

    # Locate the header row dynamically — first cell must equal "Timestamp"
    header_idx = None
    for i, line in enumerate(lines):
        first_cell = line.split(",")[0].strip()
        if first_cell == "Timestamp":
            header_idx = i
            break

    if header_idx is None:
        raise ValueError(
            "No 'Timestamp' header row found. Ensure this is a valid sensor CSV "
            "with a preamble followed by a Timestamp column."
        )

    # Extract key-value metadata from the preamble
    metadata = {}
    for line in lines[:header_idx]:
        stripped = line.strip()
        if not stripped or stripped.startswith("sep="):
            continue
        parts = stripped.split(",", 1)
        if len(parts) == 2:
            key = parts[0].strip().rstrip(":")
            val = parts[1].strip()
            if key and val:
                metadata[key] = val

    # Parse the data table starting at the header row
    data_text = "\n".join(lines[header_idx:])
    df = pd.read_csv(io.StringIO(data_text))

    # Match columns by keyword, not exact name
    usage_col = next((c for c in df.columns if "Usage" in c), None)
    temp_col   = next((c for c in df.columns if "Temperature" in c), None)

    if usage_col is None:
        raise ValueError("No column containing 'Usage' found in the data table.")
    if temp_col is None:
        raise ValueError("No column containing 'Temperature' found in the data table.")

    df["timestamp"]   = pd.to_datetime(df["Timestamp"], errors="coerce")
    df["usage"]       = pd.to_numeric(df[usage_col], errors="coerce")
    df["temperature"] = pd.to_numeric(df[temp_col],  errors="coerce")

    df = df.dropna(subset=["timestamp", "usage", "temperature"])
    df = df.sort_values("timestamp").reset_index(drop=True)

    return metadata, df


# --- VISUALIZE ENDPOINT ---

@app.post("/api/visualize-data")
async def run_visualize_data(file: UploadFile = File(...)):
    try:
        contents = await file.read()

        try:
            metadata, df = parse_sensor_csv(contents)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

        # Cooking events = count of 0→1 transitions
        prev_usage = df["usage"].shift(1, fill_value=0)
        cooking_events = int(((df["usage"] == 1) & (prev_usage == 0)).sum())

        summary = {
            "stove_name":             metadata.get("Stove Name", "Unknown"),
            "sensor_type":            metadata.get("Sensor Type", "Unknown").strip(),
            "sensor_id":              metadata.get("Sensor ID", "Unknown"),
            "start_time":             df["timestamp"].iloc[0].isoformat(),
            "end_time":               df["timestamp"].iloc[-1].isoformat(),
            "total_readings":         len(df),
            "max_temperature":        round(float(df["temperature"].max()), 2),
            "min_temperature":        round(float(df["temperature"].min()), 2),
            "mean_temperature":       round(float(df["temperature"].mean()), 2),
            "usage_percent":          round(float(df["usage"].mean() * 100), 1),
            "cooking_events":         cooking_events,
            "cooking_events_per_day": metadata.get("Cooking Events per day", "N/A"),
            "cooking_time_per_day":   metadata.get("Cooking Time (min/day)", "N/A"),
        }

        # Build data array — .tolist() converts numpy scalars to Python floats
        timestamps = df["timestamp"].dt.strftime("%Y-%m-%dT%H:%M:%S").tolist()
        usages     = df["usage"].tolist()
        temps      = df["temperature"].tolist()
        data = [
            {"timestamp": ts, "usage": u, "temperature": t}
            for ts, u, t in zip(timestamps, usages, temps)
        ]

        return {"filename": file.filename, "summary": summary, "data": data}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))