# Curated training batches (customer voice)

These files are **authored** support questions—not parametric template spam.

| File | Role |
|------|------|
| `batch-060-entries.jsonl` | Source: 1000 Hinglish customer Q&As (`topics`, `context_fields`, `solution`) |
| `../batch-060.jsonl` | Packed training batch with ids `b060-hi-0001` … |
| `batch-061-entries.jsonl` | **MF + KYC + Account Settings** modules (Hinglish) |
| `../batch-061.jsonl` | Packed batch `b061-mf-0001` … |

## Rebuild curated batches

```bash
cd Backend
python3 scripts/build_curated_hinglish_batch_060.py
python3 scripts/_gen_curated_batch_061.py   # refresh source (no fake amounts)
python3 scripts/build_curated_batch.py --batch 61 --source curated/batch-061-entries.jsonl --count 1000 --slug-prefix mf --notes "Curated Hinglish: MF modules, KYC, Account Settings"
```

Generic packer:

```bash
python3 scripts/build_curated_batch.py --batch N --source curated/batch-NNN-entries.jsonl --count 1000 --slug-prefix cur --notes "..."
```

The builder rejects duplicates and any question that already exists in other `batch-*.jsonl` files.

Edit `batch-060-entries.jsonl` by hand when adding real customer phrasing from tickets (anonymized).
