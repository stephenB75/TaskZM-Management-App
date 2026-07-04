/**
 * Analytics PDF export — lazy-loads jsPDF and html2canvas.
 */

import type React from "react";
import {
  ANALYTICS_LABELS,
  ANALYTICS_PDF_CONFIG,
} from "./analytics-constants";
import type { AnalyticsResult } from "./analytics-utils";
import { formatAnalyticsDurationLabel } from "./analytics-utils";
import { COLOR_SUCCESS } from "./color-theme";

type ChartRef = React.RefObject<HTMLDivElement | null>;

interface ExportAnalyticsPdfOptions {
  analytics: AnalyticsResult;
  isDark: boolean;
  statusChartRef: ChartRef;
  timeTrendChartRef: ChartRef;
  tasksCreatedCompletedChartRef: ChartRef;
  timeOfDayChartRef: ChartRef;
  topTagsChartRef: ChartRef;
  onProgress: (value: number) => void;
}

function hexToRgb(hex: string): [number, number, number] {
  try {
    const cleanHex = hex.replace("#", "");
    return [
      parseInt(cleanHex.substring(0, 2), 16),
      parseInt(cleanHex.substring(2, 4), 16),
      parseInt(cleanHex.substring(4, 6), 16),
    ];
  } catch {
    return [0, 0, 0];
  }
}

export async function exportAnalyticsPdf({
  analytics,
  isDark,
  statusChartRef,
  timeTrendChartRef,
  tasksCreatedCompletedChartRef,
  timeOfDayChartRef,
  topTagsChartRef,
  onProgress,
}: ExportAnalyticsPdfOptions): Promise<void> {
  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import("jspdf"),
    import("html2canvas"),
  ]);

  const doc = new jsPDF({
    orientation: ANALYTICS_PDF_CONFIG.orientation,
    unit: ANALYTICS_PDF_CONFIG.unit,
    format: ANALYTICS_PDF_CONFIG.pageSize,
  });

  let yPos = ANALYTICS_PDF_CONFIG.margins.top;
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();

  const svgToCanvas = (svg: SVGSVGElement, width: number, height: number): Promise<HTMLCanvasElement> =>
    new Promise((resolve, reject) => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = width * ANALYTICS_PDF_CONFIG.chart.quality;
        canvas.height = height * ANALYTICS_PDF_CONFIG.chart.quality;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }
        ctx.fillStyle = isDark
          ? ANALYTICS_PDF_CONFIG.chart.backgroundColor.dark
          : ANALYTICS_PDF_CONFIG.chart.backgroundColor.light;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const svgData = new XMLSerializer().serializeToString(svg);
        const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(svgBlob);
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          URL.revokeObjectURL(url);
          resolve(canvas);
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error("Failed to load SVG image"));
        };
        img.src = url;
      } catch (error) {
        reject(error);
      }
    });

  const captureChart = async (ref: ChartRef, title: string): Promise<string | null> => {
    if (!ref.current) return null;
    const element = ref.current;
    if (element.offsetWidth === 0 || element.offsetHeight === 0) return null;

    await new Promise((resolve) =>
      setTimeout(
        resolve,
        ANALYTICS_PDF_CONFIG.chart.waitForRender || ANALYTICS_PDF_CONFIG.chart.fallbackWaitForRender,
      ),
    );
    void element.offsetHeight;
    await new Promise((resolve) => setTimeout(resolve, ANALYTICS_PDF_CONFIG.chart.reflowDelay));

    const svgElement = element.querySelector("svg") as SVGSVGElement | null;
    if (!svgElement) {
      const canvas = await html2canvas(element, {
        backgroundColor: isDark
          ? ANALYTICS_PDF_CONFIG.chart.backgroundColor.dark
          : ANALYTICS_PDF_CONFIG.chart.backgroundColor.light,
        scale: ANALYTICS_PDF_CONFIG.chart.quality,
        logging: false,
        useCORS: true,
        allowTaint: true,
      });
      return canvas.toDataURL(ANALYTICS_PDF_CONFIG.chart.imageFormat, 1);
    }

    const svgRect = svgElement.getBoundingClientRect();
    if (svgRect.width === 0 || svgRect.height === 0) return null;
    if (!svgElement.getAttribute("width") || !svgElement.getAttribute("height")) {
      svgElement.setAttribute("width", String(svgRect.width));
      svgElement.setAttribute("height", String(svgRect.height));
    }
    if (!svgElement.getAttribute("viewBox")) {
      svgElement.setAttribute("viewBox", `0 0 ${svgRect.width} ${svgRect.height}`);
    }

    try {
      const canvas = await svgToCanvas(svgElement, svgRect.width, svgRect.height);
      return canvas.toDataURL(ANALYTICS_PDF_CONFIG.chart.imageFormat, 1);
    } catch {
      const canvas = await html2canvas(element, {
        backgroundColor: isDark
          ? ANALYTICS_PDF_CONFIG.chart.backgroundColor.dark
          : ANALYTICS_PDF_CONFIG.chart.backgroundColor.light,
        scale: ANALYTICS_PDF_CONFIG.chart.quality,
        logging: false,
        useCORS: true,
        allowTaint: true,
      });
      return canvas.toDataURL(ANALYTICS_PDF_CONFIG.chart.imageFormat, 1);
    }
  };

  const addSeparator = () => {
    if (yPos + ANALYTICS_PDF_CONFIG.pdfSpacing.separatorThreshold > pageHeight - ANALYTICS_PDF_CONFIG.margins.bottom) {
      doc.addPage();
      yPos = ANALYTICS_PDF_CONFIG.margins.top;
    }
    const [r, g, b] = hexToRgb(ANALYTICS_PDF_CONFIG.colors.border);
    doc.setDrawColor(r, g, b);
    doc.setLineWidth(
      ANALYTICS_PDF_CONFIG.pdfStyling.borderWidth * ANALYTICS_PDF_CONFIG.pdfStyling.separatorWidthMultiplier,
    );
    doc.line(ANALYTICS_PDF_CONFIG.margins.left, yPos, pageWidth - ANALYTICS_PDF_CONFIG.margins.right, yPos);
    yPos += ANALYTICS_PDF_CONFIG.spacing.afterHeading;
  };

  const addMetricBox = (label: string, value: string, x: number, width: number) => {
    const boxHeight = ANALYTICS_PDF_CONFIG.pdfSpacing.metricBoxHeight;
    const [rPrimary, gPrimary, bPrimary] = hexToRgb(ANALYTICS_PDF_CONFIG.colors.primary);
    const [rBg, gBg, bBg] = hexToRgb(ANALYTICS_PDF_CONFIG.colors.boxBackground);
    const [rText, gText, bText] = hexToRgb(ANALYTICS_PDF_CONFIG.colors.text);
    doc.setFillColor(rBg, gBg, bBg);
    doc.rect(x, yPos, width, boxHeight, "F");
    doc.setFontSize(ANALYTICS_PDF_CONFIG.fontSizes.small);
    doc.setTextColor(rText, gText, bText);
    doc.text(label, x + ANALYTICS_PDF_CONFIG.pdfSpacing.textOffset, yPos + ANALYTICS_PDF_CONFIG.pdfSpacing.metricBoxLabelY);
    doc.setFontSize(ANALYTICS_PDF_CONFIG.fontSizes.body);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(rPrimary, gPrimary, bPrimary);
    doc.text(value, x + ANALYTICS_PDF_CONFIG.pdfSpacing.textOffset, yPos + ANALYTICS_PDF_CONFIG.pdfSpacing.metricBoxValueY);
    doc.setFont("helvetica", "normal");
  };

  const addChartToPDF = async (imageData: string, title: string) => {
    const chartBoxHeight = ANALYTICS_PDF_CONFIG.chart.height + ANALYTICS_PDF_CONFIG.pdfSpacing.chartBoxPadding;
    if (yPos + chartBoxHeight > pageHeight - ANALYTICS_PDF_CONFIG.margins.bottom) {
      doc.addPage();
      yPos = ANALYTICS_PDF_CONFIG.margins.top;
    }
    addSeparator();
    doc.setFontSize(ANALYTICS_PDF_CONFIG.fontSizes.heading);
    doc.setFont("helvetica", "bold");
    const [r, g, b] = hexToRgb(ANALYTICS_PDF_CONFIG.colors.primary);
    doc.setTextColor(r, g, b);
    doc.text(title, ANALYTICS_PDF_CONFIG.margins.left, yPos);
    doc.setFont("helvetica", "normal");
    yPos += ANALYTICS_PDF_CONFIG.spacing.afterHeading + ANALYTICS_PDF_CONFIG.pdfSpacing.chartTitleOffset;

    const chartWidth = ANALYTICS_PDF_CONFIG.chart.width;
    const img = new Image();
    img.src = imageData;
    await new Promise((resolve) => {
      img.onload = resolve;
    });
    const chartHeight = chartWidth / (img.width / img.height);
    doc.addImage(
      imageData,
      ANALYTICS_PDF_CONFIG.chart.pdfImageFormat,
      ANALYTICS_PDF_CONFIG.margins.left,
      yPos,
      chartWidth,
      chartHeight,
    );
    yPos += chartHeight + ANALYTICS_PDF_CONFIG.chart.spacing + ANALYTICS_PDF_CONFIG.pdfSpacing.chartBottomSpacing;
  };

  onProgress(ANALYTICS_PDF_CONFIG.progress.initial);
  doc.setFontSize(ANALYTICS_PDF_CONFIG.fontSizes.title + ANALYTICS_PDF_CONFIG.pdfStyling.titleFontSizeIncrease);
  const [rTitle, gTitle, bTitle] = hexToRgb(ANALYTICS_PDF_CONFIG.colors.primary);
  doc.setTextColor(rTitle, gTitle, bTitle);
  doc.text(ANALYTICS_PDF_CONFIG.labels.title, ANALYTICS_PDF_CONFIG.margins.left, yPos);
  yPos += ANALYTICS_PDF_CONFIG.spacing.afterTitle + ANALYTICS_PDF_CONFIG.spacing.afterTitleExtra;
  onProgress(ANALYTICS_PDF_CONFIG.progress.afterTitle);

  doc.setFontSize(ANALYTICS_PDF_CONFIG.fontSizes.small);
  const [rDate, gDate, bDate] = hexToRgb(ANALYTICS_PDF_CONFIG.colors.textSecondary);
  doc.setTextColor(rDate, gDate, bDate);
  doc.text(
    `${ANALYTICS_PDF_CONFIG.labels.generated} ${new Date().toLocaleDateString()} · ${analytics.dateRangeLabel}`,
    ANALYTICS_PDF_CONFIG.margins.left,
    yPos,
  );
  yPos += ANALYTICS_PDF_CONFIG.spacing.afterDate + ANALYTICS_PDF_CONFIG.spacing.afterDateExtra;

  doc.setFontSize(ANALYTICS_PDF_CONFIG.fontSizes.heading);
  const [rHeading, gHeading, bHeading] = hexToRgb(ANALYTICS_PDF_CONFIG.colors.text);
  doc.setTextColor(rHeading, gHeading, bHeading);
  doc.text(ANALYTICS_PDF_CONFIG.labels.summary, ANALYTICS_PDF_CONFIG.margins.left, yPos);
  yPos += ANALYTICS_PDF_CONFIG.spacing.afterHeading + ANALYTICS_PDF_CONFIG.spacing.afterHeadingExtra;

  const boxWidth =
    (pageWidth - ANALYTICS_PDF_CONFIG.margins.left - ANALYTICS_PDF_CONFIG.margins.right - ANALYTICS_PDF_CONFIG.spacing.boxSpacing) /
    2;
  const boxSpacing = ANALYTICS_PDF_CONFIG.spacing.boxSpacing;
  const startX = ANALYTICS_PDF_CONFIG.margins.left;

  addMetricBox(ANALYTICS_PDF_CONFIG.labels.totalTasks, String(analytics.totalTasks), startX, boxWidth);
  addMetricBox(ANALYTICS_PDF_CONFIG.labels.completed, String(analytics.completedTasks), startX + boxWidth + boxSpacing, boxWidth);
  yPos += ANALYTICS_PDF_CONFIG.pdfSpacing.metricBoxRowSpacing;

  addMetricBox(ANALYTICS_PDF_CONFIG.labels.inProgress, String(analytics.inProgressTasks), startX, boxWidth);
  addMetricBox(
    ANALYTICS_PDF_CONFIG.labels.completionRate,
    `${analytics.completionRate.toFixed(1)}%`,
    startX + boxWidth + boxSpacing,
    boxWidth,
  );
  yPos += ANALYTICS_PDF_CONFIG.spacing.afterSection + ANALYTICS_PDF_CONFIG.spacing.afterSectionExtra;

  doc.text(ANALYTICS_PDF_CONFIG.labels.timeTracking, ANALYTICS_PDF_CONFIG.margins.left, yPos);
  yPos += ANALYTICS_PDF_CONFIG.spacing.afterHeading + ANALYTICS_PDF_CONFIG.spacing.afterHeadingExtra;

  addMetricBox(ANALYTICS_PDF_CONFIG.labels.totalTime, formatAnalyticsDurationLabel(analytics.totalTimeTracked), startX, boxWidth);
  addMetricBox(
    ANALYTICS_PDF_CONFIG.labels.thisWeek,
    formatAnalyticsDurationLabel(analytics.weeklyTimeTracked),
    startX + boxWidth + boxSpacing,
    boxWidth,
  );
  yPos += ANALYTICS_PDF_CONFIG.pdfSpacing.metricBoxRowSpacing;

  if (analytics.avgTimePerTask > 0) {
    addMetricBox(
      ANALYTICS_PDF_CONFIG.labels.avgPerTask,
      formatAnalyticsDurationLabel(analytics.avgTimePerTask),
      startX,
      boxWidth,
    );
    yPos += ANALYTICS_PDF_CONFIG.pdfSpacing.metricBoxRowSpacing;
  }

  if (analytics.avgCompletionTime > 0) {
    addMetricBox(
      ANALYTICS_PDF_CONFIG.labels.avgCompletion,
      `${analytics.avgCompletionTime.toFixed(1)} ${ANALYTICS_PDF_CONFIG.labels.days}`,
      startX + boxWidth + boxSpacing,
      boxWidth,
    );
    yPos += ANALYTICS_PDF_CONFIG.pdfSpacing.metricBoxRowSpacing;
  }

  yPos += ANALYTICS_PDF_CONFIG.spacing.afterSection;

  const chartsToCapture = [
    {
      ref: statusChartRef,
      label: ANALYTICS_PDF_CONFIG.labels.statusDistribution,
      condition: analytics.statusDistribution.length > 0,
    },
    {
      ref: timeTrendChartRef,
      label: ANALYTICS_LABELS.chartTimeTracked(analytics.chartDays),
      condition: analytics.timeTrackingTrend.length > 0,
    },
    {
      ref: tasksCreatedCompletedChartRef,
      label: ANALYTICS_PDF_CONFIG.labels.chartTasksCreatedCompleted,
      condition: analytics.taskPerDayProgress.length > 0,
    },
    {
      ref: timeOfDayChartRef,
      label: ANALYTICS_PDF_CONFIG.labels.chartCompletionByTimeOfDay,
      condition: analytics.timePatterns.buckets.length > 0,
    },
    {
      ref: topTagsChartRef,
      label: ANALYTICS_PDF_CONFIG.labels.chartTopTaskTags,
      condition: analytics.taskTypes.length > 0,
    },
  ].filter((chart) => chart.condition && chart.ref.current);

  const totalCharts = chartsToCapture.length;
  let chartsCaptured = 0;
  const chartProgressRange = ANALYTICS_PDF_CONFIG.progress.chartEnd - ANALYTICS_PDF_CONFIG.progress.chartStart;

  for (const chart of chartsToCapture) {
    onProgress(
      Math.round((chartsCaptured / Math.max(totalCharts, 1)) * chartProgressRange + ANALYTICS_PDF_CONFIG.progress.chartStart),
    );
    const chartImage = await captureChart(chart.ref, chart.label);
    if (chartImage) {
      await addChartToPDF(chartImage, chart.label);
    }
    chartsCaptured += 1;
  }

  if (analytics.projectProgress.length > 0) {
    addSeparator();
    doc.setFontSize(ANALYTICS_PDF_CONFIG.fontSizes.heading);
    const [rProject, gProject, bProject] = hexToRgb(ANALYTICS_PDF_CONFIG.colors.primary);
    doc.setTextColor(rProject, gProject, bProject);
    doc.text(ANALYTICS_PDF_CONFIG.labels.projectProgress, ANALYTICS_PDF_CONFIG.margins.left, yPos);
    yPos += ANALYTICS_PDF_CONFIG.spacing.afterHeading + ANALYTICS_PDF_CONFIG.spacing.afterHeadingExtra;

    const [rBg, gBg, bBg] = hexToRgb(ANALYTICS_PDF_CONFIG.colors.boxBackground);
    analytics.projectProgress.slice(0, ANALYTICS_PDF_CONFIG.limits.maxProjects).forEach((project) => {
      if (yPos > pageHeight - ANALYTICS_PDF_CONFIG.margins.bottom - ANALYTICS_PDF_CONFIG.pageBreak.threshold) {
        doc.addPage();
        yPos = ANALYTICS_PDF_CONFIG.margins.top;
      }
      const rowHeight = ANALYTICS_PDF_CONFIG.pdfSpacing.projectRowHeight;
      const tableWidth = pageWidth - ANALYTICS_PDF_CONFIG.margins.left - ANALYTICS_PDF_CONFIG.margins.right;
      doc.setFillColor(rBg, gBg, bBg);
      doc.rect(
        ANALYTICS_PDF_CONFIG.margins.left,
        yPos - rowHeight + ANALYTICS_PDF_CONFIG.pdfSpacing.projectRowOffset,
        tableWidth,
        rowHeight,
        "F",
      );
      doc.setFontSize(ANALYTICS_PDF_CONFIG.fontSizes.body);
      doc.setFont("helvetica", "bold");
      const [rText, gText, bText] = hexToRgb(ANALYTICS_PDF_CONFIG.colors.primary);
      doc.setTextColor(rText, gText, bText);
      doc.text(
        project.name,
        ANALYTICS_PDF_CONFIG.margins.left + ANALYTICS_PDF_CONFIG.pdfSpacing.textOffset,
        yPos - ANALYTICS_PDF_CONFIG.pdfSpacing.textOffset,
      );
      doc.setFont("helvetica", "normal");
      doc.setFontSize(ANALYTICS_PDF_CONFIG.fontSizes.small);
      const [rSecondary, gSecondary, bSecondary] = hexToRgb(ANALYTICS_PDF_CONFIG.colors.textSecondary);
      doc.setTextColor(rSecondary, gSecondary, bSecondary);
      doc.text(
        `${project.completed}/${project.total} tasks`,
        ANALYTICS_PDF_CONFIG.margins.left + ANALYTICS_PDF_CONFIG.pdfSpacing.textOffset,
        yPos + ANALYTICS_PDF_CONFIG.pdfSpacing.verticalOffset,
      );
      doc.setFontSize(ANALYTICS_PDF_CONFIG.fontSizes.body);
      doc.setFont("helvetica", "bold");
      const [rSuccess, gSuccess, bSuccess] = hexToRgb(COLOR_SUCCESS);
      doc.setTextColor(rSuccess, gSuccess, bSuccess);
      const rateText = `${project.completionRate.toFixed(0)}%`;
      const textWidth = doc.getTextWidth(rateText);
      doc.text(
        rateText,
        pageWidth - ANALYTICS_PDF_CONFIG.margins.right - textWidth - ANALYTICS_PDF_CONFIG.pdfSpacing.textOffset,
        yPos - ANALYTICS_PDF_CONFIG.pdfSpacing.textOffset,
      );
      doc.setFont("helvetica", "normal");
      yPos += rowHeight + ANALYTICS_PDF_CONFIG.spacing.projectRowExtra;
    });
  }

  onProgress(ANALYTICS_PDF_CONFIG.progress.beforeSave);
  const fileName = `${ANALYTICS_PDF_CONFIG.fileName}-${new Date().toISOString().split("T")[0]}.pdf`;
  doc.save(fileName);
  onProgress(ANALYTICS_PDF_CONFIG.progress.complete);
}
