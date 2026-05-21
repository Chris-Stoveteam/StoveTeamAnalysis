import os
import math
import pandas as pd
import numpy as np
import scipy.stats as stats

def clear_console():
    """Clears the terminal screen for Windows, macOS, and Linux."""
    os.system('cls' if os.name == 'nt' else 'clear')

def calculate_kpt_sample_size(df, target_col, confidence_level=0.90, precision=0.10):
    """
    Calculates the required sample size for a KPT study from a DataFrame.
    """
    # 1. Calculate Mean and Standard Deviation from the dataframe column
    mean_val = df[target_col].mean()
    sd_val = df[target_col].std()
    
    # 2. Calculate the Coefficient of Variation (COV)
    if mean_val == 0:
        raise ValueError("Mean of the target column is zero, cannot calculate COV.")
    cov = sd_val / mean_val
    
    # 3. Calculate the z-score for the confidence level
    alpha = 1 - confidence_level
    z_score = stats.norm.ppf(1 - alpha / 2)
    
    # 4. Standard sample size formula: n = (z * cov / precision)^2
    n_required = math.ceil((z_score * cov / precision)**2)
    
    # Print the results
    print(f"--- KPT Sample Size Analysis ---")
    print(f"Target Column: '{target_col}'")
    print(f"Mean: {mean_val:.2f} | SD: {sd_val:.2f}")
    print(f"COV: {cov:.4f}")
    print(f"Confidence: {confidence_level*100}% (z-score: {z_score:.3f})")
    print(f"Precision Target: {precision*100}%")
    print(f"--------------------------------")
    print(f"Required Sample Size: {n_required} households")
    
    return n_required

def calculate_kpt_confidence(data_series, confidence_level=0.90, target_margin_percent=0.10):
    """
    Analyzes an array of data to determine if it meets the confidence and margin of error rules.
    """
    # 1. Calculate basic statistics
    n = len(data_series)
    mean_val = np.mean(data_series)
    std_val = np.std(data_series, ddof=1)
    
    # 2. Calculate the t-critical value
    alpha = 1 - confidence_level
    t_crit = stats.t.ppf(1 - (alpha / 2), df=n - 1)
    
    # 3. Calculate Margin of Error (MoE)
    margin_of_error = t_crit * (std_val / np.sqrt(n))
    
    # 4. Calculate Relative Margin of Error (MoE as a percentage of the mean)
    relative_moe = margin_of_error / mean_val
    
    # 5. Check if it meets the criteria
    meets_criteria = relative_moe <= target_margin_percent
    
    # --- Print Report ---
    print("--- KPT Confidence Analysis Report ---")
    print(f"Sample Size (n): {n}")
    print(f"Mean Per Capita Fuel Use: {round(mean_val, 4)}")
    print(f"Standard Deviation: {round(std_val, 4)}")
    print(f"Absolute Margin of Error: ±{round(margin_of_error, 4)}")
    print(f"Relative Margin of Error: {round(relative_moe * 100, 2)}%")
    print("-" * 38)
    
    if meets_criteria:
        print("✅ SUCCESS: The data MEETS the 90/10 confidence rule.")
    else:
        print("❌ WARNING: The data DOES NOT meet the 90/10 confidence rule.")
        print("You may need a larger sample size to achieve the required precision.")

def calculate_change(group_a, group_b):
    """
    Calculates the absolute and percentage change between the means of two groups.
    """
    mean_a = np.mean(group_a)
    mean_b = np.mean(group_b)
    
    absolute_change = mean_b - mean_a
    # Handle division by zero just in case
    if mean_a == 0:
        percent_change = np.nan 
    else:
        percent_change = (absolute_change / mean_a) * 100

    print(f"--- Calculated Changes ---")    
    print(f"Baseline Mean: {mean_a:.2f}")
    print(f"NewStove Mean: {mean_b:.2f}")
    print(f"Absolute Change: {absolute_change:.2f}")
    print(f"---------------------------------")
    print(f"Percentage Change: {percent_change:.2f}%")
    
    return absolute_change, percent_change

def test_significance(group_a, group_b, paired=False, alpha=0.05):
    """
    Determines if the difference between two groups is statistically significant.
    """
    group_a = pd.Series(group_a).dropna()
    group_b = pd.Series(group_b).dropna()
    
    if paired:
        stat, p_value = stats.ttest_rel(group_a, group_b)
        test_type = "Paired T-Test"
    else:
        stat, p_value = stats.ttest_ind(group_a, group_b, equal_var=False)
        test_type = "Independent T-Test (Welch's)"
        
    is_significant = p_value < alpha
    
    print(f"--- {test_type} Results ---")
    print(f"T-statistic: {stat:.4f}")
    print(f"P-value: {p_value:.4f}")
    print(f"---------------------------------")
    
    if is_significant:
        print(f"Result: ✅ SIGNIFICANT (p < {alpha}). The change is statistically significant.")
    else:
        print(f"Result: ❌ NOT SIGNIFICANT (p >= {alpha}). There is no statistically significant change.")
        
    return is_significant, p_value

def main():
    target_confidence = 0.90
    target_precision = 0.10
    data_dir = 'data'
    target_column = 'Dry_Wood_Per_Cap'

    # 1. Check if data folder exists and find CSV files dynamically
    if not os.path.exists(data_dir):
        print(f"Error: The directory '{data_dir}' was not found. Please create it and add your CSV files.")
        return

    csv_files = [f for f in os.listdir(data_dir) if f.endswith('.csv')]
    
    if not csv_files:
        print(f"Error: No CSV files found in the '{data_dir}' directory.")
        return

    # 2. Prompt the user for the analysis type
    print("What type of analysis would you like to run?")
    print("1: Single Analysis (Sample size & confidence on one file)")
    print("2: Full Analysis (Confidence, change, and significance across two files)")
    
    try:
        choice = input("\nEnter 1 or 2: ").strip()
        
        if choice not in ['1', '2']:
            print("Invalid selection. Exiting.")
            return

        # Clear console after the first menu selection
        clear_console()

        # Display dynamic list of files (removing the .csv extension for cleaner reading)
        print("\nAvailable files in data folder:")
        for i, file_name in enumerate(csv_files, 1):
            clean_name = file_name.replace('.csv', '')
            print(f"{i}: {clean_name}")

        if choice == '1':
            # --- SINGLE ANALYSIS ---
            file_idx = int(input("\nEnter the number of the file to analyze: ").strip()) - 1
            
            # Clear console before printing the Single Analysis reports
            clear_console()
            
            selected_file = csv_files[file_idx]
            
            print(f"\nLoading {selected_file}...")
            df = pd.read_csv(os.path.join(data_dir, selected_file))
            
            print("\n")
            calculate_kpt_sample_size(df, target_column, target_confidence, target_precision)
            print("\n")
            calculate_kpt_confidence(df[target_column], confidence_level=target_confidence, target_margin_percent=target_precision)

        elif choice == '2':
            # --- FULL ANALYSIS ---
            if len(csv_files) < 2:
                print("\nError: Full analysis requires at least 2 CSV files in the data folder.")
                return

            base_idx = int(input("\nEnter the number for the BASELINE data: ").strip()) - 1
            new_idx = int(input("Enter the number for the NEW STOVE data: ").strip()) - 1
            
            # Clear console before printing the Full Analysis reports
            clear_console()
            
            baseline_file = csv_files[base_idx]
            newstove_file = csv_files[new_idx]
            
            print(f"\nLoading Baseline: {baseline_file}")
            print(f"Loading New Stove: {newstove_file}...")
            
            baseline_df = pd.read_csv(os.path.join(data_dir, baseline_file))
            newstove_df = pd.read_csv(os.path.join(data_dir, newstove_file))
            
            print("\n")
            calculate_kpt_sample_size(baseline_df, target_column, target_confidence, target_precision)
            print("\n")
            calculate_kpt_confidence(baseline_df[target_column], confidence_level=target_confidence, target_margin_percent=target_precision)
            print("\n")
            calculate_change(baseline_df[target_column], newstove_df[target_column])
            print("\n")
            test_significance(baseline_df[target_column], newstove_df[target_column], paired=False, alpha=0.05)

    except (ValueError, IndexError):
        print("\nError: Invalid input. Please make sure you enter a valid number corresponding to the menu options.")

    input("\nAnalysis complete. Press Enter to exit...")

if __name__ == "__main__":
    main()