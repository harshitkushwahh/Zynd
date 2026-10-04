FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PYTHONPATH=/app

# Slug-named public copies (for example icici-mutual-fund.png) are what the
# asset route serves. They are produced from assets/amc-logos/manifest.json.
RUN python -m app.application.mf.publish_bundled_amc_logos

CMD ["python", "-m", "app.jobs.run_deletion_scheduler", "--schedule"]
