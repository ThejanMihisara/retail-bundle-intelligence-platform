import joblib
from pathlib import Path
import pandas as pd

# Load model
model_path = Path(r"c:\Users\Insight®\Desktop\new\original project 1\backend\models\bundle_recommendation\bundle_recommendation_model.joblib")
model = joblib.load(model_path)
recs_df = model['bundle_recommendations']
prod_prof = model['product_profile']

# Create a lookup dictionary from product_profile: product_id -> movement_label
movement_lookup = dict(zip(prod_prof['product_id'].astype(str), prod_prof['movement_label']))

# Now check each bundle and count actual fast, medium, slow products based on the lookup
results = []
for idx, row in recs_df.iterrows():
    pids = str(row['product_ids']).split(',')
    labels = [movement_lookup.get(pid, 'Unknown') for pid in pids]
    
    fast_c = sum(1 for l in labels if l == 'Fast')
    med_c = sum(1 for l in labels if l == 'Medium')
    slow_c = sum(1 for l in labels if l == 'Slow')
    unknown_c = sum(1 for l in labels if l == 'Unknown')
    
    results.append({
        'bundle_id': row['bundle_id'],
        'fast': fast_c,
        'medium': med_c,
        'slow': slow_c,
        'unknown': unknown_c,
        'labels': labels
    })

results_df = pd.DataFrame(results)
print("=== Actual product movement labels in bundles based on product_profile ===")
print("Fast product counts distribution:")
print(results_df['fast'].value_counts())
print("\nMedium product counts distribution:")
print(results_df['medium'].value_counts())
print("\nSlow product counts distribution:")
print(results_df['slow'].value_counts())
print("\nUnknown product counts distribution:")
print(results_df['unknown'].value_counts())

# Let's see if there are bundles containing both Fast and Slow products!
fs_bundles = results_df[(results_df['fast'] >= 1) & (results_df['slow'] >= 1)]
print(f"\nActual bundles with >=1 Fast and >=1 Slow product: {len(fs_bundles)}")
if len(fs_bundles) > 0:
    print(fs_bundles.head(5))
