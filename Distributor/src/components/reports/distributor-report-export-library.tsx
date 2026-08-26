"use client";

import { DistributorReportTemplateCard } from "@/components/reports/distributor-report-template-card";
import { DistributorReportsInsightPanel } from "@/components/reports/distributor-reports-insight-panel";
import { DUMMY_DISTRIBUTOR_REPORT_TEMPLATES } from "@/lib/distributor-reports-data";

export function DistributorReportExportLibrary() {
  return (
    <>
      <DistributorReportsInsightPanel />

      <section className="distributor-report-export-library">
        <h2 className="distributor-report-export-library__title">All Reports</h2>
        <ul className="distributor-report-export-library__grid" aria-label="Downloadable reports">
          {DUMMY_DISTRIBUTOR_REPORT_TEMPLATES.map((template) => (
            <li key={template.id}>
              <DistributorReportTemplateCard template={template} />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
