"use client";

import { Download, Database, X } from "lucide-react";
import { useState } from "react";

function AMCContractBulk({ onClose, getData }) {
  const [file, setFile] = useState(null);
  const [activeTab, setActiveTab] = useState("upload");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");
  const [resultFilter, setResultFilter] = useState("All");
  const [isDragging, setIsDragging] = useState(false);
  const [processingData, setProcessingData] = useState({
    status: "idle",
    startTime: null,
    endTime: null,
    duration: null,
    totalRecords: 0,
    processedRecords: 0,
    successfulRecords: 0,
    failedRecords: 0,
    results: [],
    summary: {
      created: 0,
      updated: 0,
      failed: 0,
      duplicatesInFile: 0,
      existingRecords: 0,
      skippedTotal: 0,
    },
    headerMapping: {},
    errors: [],
    warnings: [],
    batchProgress: {
      currentBatch: 0,
      totalBatches: 0,
      batchSize: 1000,
      currentBatchRecords: 0,
    }
  });
  const [liveUpdates, setLiveUpdates] = useState([]);

  const addLiveUpdate = (message, type = "info") => {
    const update = {
      id: Date.now(),
      message,
      type,
      timestamp: new Date().toLocaleTimeString(),
    };
    setLiveUpdates((prev) => [update, ...prev.slice(0, 19)]);
  };

  const statusCounts = processingData.results.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});

  const filterTabs = [
    { label: "All", value: "All", count: processingData.results.length },
    { label: "Created", value: "Created", count: statusCounts.Created || 0 },
    { label: "Updated", value: "Updated", count: statusCounts.Updated || 0 },
    { label: "Skipped", value: "Skipped", count: statusCounts.Skipped || 0 },
    { label: "Failed", value: "Failed", count: statusCounts.Failed || 0 },
  ];

  const filteredResults =
    resultFilter === "All"
      ? processingData.results
      : processingData.results.filter((r) => r.status === resultFilter);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0] || null;
    validateAndSetFile(selectedFile);
  };

  const validateAndSetFile = (selectedFile) => {
    setError("");
    if (!selectedFile) {
      setFile(null);
      return;
    }
    const fileExtension = selectedFile.name.split(".").pop()?.toLowerCase();
    if (!["csv", "xls", "xlsx"].includes(fileExtension || "")) {
      setError("Please upload a CSV or Excel file (.csv, .xls, .xlsx)");
      setFile(null);
      return;
    }
    if (selectedFile.size > 50 * 1024 * 1024) {
      setError("File size exceeds 50MB limit");
      setFile(null);
      return;
    }
    setFile(selectedFile);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    validateAndSetFile(droppedFile);
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsProcessing(true);
    setLiveUpdates([]);
    setProcessingData({
      status: "processing",
      startTime: new Date(),
      endTime: null,
      duration: null,
      totalRecords: 0,
      processedRecords: 0,
      successfulRecords: 0,
      failedRecords: 0,
      results: [],
      summary: {
        created: 0,
        updated: 0,
        failed: 0,
        duplicatesInFile: 0,
        existingRecords: 0,
        skippedTotal: 0,
      },
      headerMapping: {},
      errors: [],
      warnings: [],
      batchProgress: {
        currentBatch: 0,
        totalBatches: 0,
        batchSize: 1000,
        currentBatchRecords: 0,
      }
    });

    const formData = new FormData();
    formData.append("file", file);

    try {
      addLiveUpdate("Starting AMC Contract batch upload...", "info");
      
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), 600000);

      const response = await fetch(
        `${process.env.REACT_APP_BASE_URL}/bulk/amccontract/bulk-upload`,
        {
          method: "POST",
          body: formData,
          signal: abortController.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      addLiveUpdate(
        "File uploaded successfully. Processing AMC Contract records in batches...",
        "success"
      );

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let partialLine = "";
      let retryCount = 0;
      const maxRetries = 3;

      while (retryCount < maxRetries) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = partialLine + decoder.decode(value, { stream: true });
            const lines = chunk.split("\n");
            partialLine = lines.pop() || "";

            for (const line of lines) {
              if (!line.trim()) continue;

              try {
                const data = JSON.parse(line);

                setProcessingData((prev) => {
                  const newData = {
                    ...prev,
                    ...data,
                    results: data.results || prev.results,
                    summary: data.summary
                      ? { ...prev.summary, ...data.summary }
                      : prev.summary,
                    headerMapping: data.headerMapping || prev.headerMapping,
                    errors: data.errors || prev.errors,
                    warnings: data.warnings || prev.warnings,
                    batchProgress: data.batchProgress || prev.batchProgress,
                  };

                  // Batch processing updates
                  if (data.batchProgress?.currentBatch > prev.batchProgress?.currentBatch) {
                    addLiveUpdate(
                      `Starting batch ${data.batchProgress.currentBatch}/${data.batchProgress.totalBatches} (${data.batchProgress.batchSize} records)`,
                      "info"
                    );
                  }

                  // Individual record processing updates
                  if (data.processedRecords > prev.processedRecords) {
                    const newlyProcessed = data.processedRecords - prev.processedRecords;
                    const batchInfo = data.batchProgress?.currentBatch 
                      ? ` [Batch ${data.batchProgress.currentBatch}/${data.batchProgress.totalBatches}]`
                      : '';
                    addLiveUpdate(
                      `Processed ${newlyProcessed} AMC Contract record(s) (${data.processedRecords}/${data.totalRecords})${batchInfo}`,
                      "success"
                    );
                  }

                  // Real-time individual record updates
                  if (data.latestRecords && data.latestRecords.length > 0) {
                    const latestRecord = data.latestRecords[data.latestRecords.length - 1];
                    addLiveUpdate(
                      `${latestRecord.status}: ${latestRecord.serialnumber} (${latestRecord.salesdoc})`,
                      latestRecord.status === 'Created' ? 'success' : 
                      latestRecord.status === 'Updated' ? 'info' :
                      latestRecord.status === 'Failed' ? 'error' : 'info'
                    );
                  }

                  if (data.summary?.created > prev.summary?.created) {
                    const newCreated = data.summary.created - prev.summary.created;
                    addLiveUpdate(
                      `Created ${newCreated} new AMC Contract records (Total: ${data.summary.created})`,
                      "success"
                    );
                  }

                  if (data.summary?.updated > prev.summary?.updated) {
                    const newUpdated = data.summary.updated - prev.summary.updated;
                    addLiveUpdate(
                      `Updated ${newUpdated} existing AMC Contract records (Total: ${data.summary.updated})`,
                      "info"
                    );
                  }

                  if (data.summary?.duplicatesInFile > prev.summary?.duplicatesInFile) {
                    const newDuplicates = data.summary.duplicatesInFile - prev.summary.duplicatesInFile;
                    addLiveUpdate(
                      `Found ${newDuplicates} file duplicates (Total: ${data.summary.duplicatesInFile})`,
                      "warning"
                    );
                  }

                  if (data.summary?.existingRecords > prev.summary?.existingRecords) {
                    const newExisting = data.summary.existingRecords - prev.summary.existingRecords;
                    addLiveUpdate(
                      `Processing ${newExisting} existing records (Total: ${data.summary.existingRecords})`,
                      "info"
                    );
                  }

                  if (data.summary?.failed > prev.summary?.failed) {
                    const newFailed = data.summary.failed - prev.summary.failed;
                    addLiveUpdate(
                      `${newFailed} records failed validation (Total: ${data.summary.failed})`,
                      "error"
                    );
                  }

                  // Batch completion updates
                  if (data.batchCompleted) {
                    addLiveUpdate(
                      `Batch ${data.batchProgress.currentBatch} completed: ${data.batchSummary?.created || 0} created, ${data.batchSummary?.updated || 0} updated, ${data.batchSummary?.failed || 0} failed`,
                      "info"
                    );
                  }

                  if (data.status === "completed") {
                    addLiveUpdate(
                      `AMC Contract batch upload completed in ${data.duration}! ` +
                        `Total Batches: ${data.batchProgress?.totalBatches || 0}, ` +
                        `Created: ${data.summary.created}, ` +
                        `Updated: ${data.summary.updated}, ` +
                        `Skipped: ${data.summary.skippedTotal}, ` +
                        `Failed: ${data.summary.failed}`,
                      "success"
                    );
                    setIsProcessing(false);
                    setActiveTab("results");
                  } else if (data.status === "failed") {
                    addLiveUpdate("AMC Contract processing failed!", "error");
                    setIsProcessing(false);
                  }

                  return newData;
                });
              } catch (parseError) {
                console.error("Error parsing JSON:", parseError, "Line:", line);
                addLiveUpdate(
                  `Error processing data chunk: ${parseError.message}`,
                  "error"
                );
              }
            }
          }

          if (partialLine.trim()) {
            try {
              const data = JSON.parse(partialLine);
              setProcessingData((prev) => ({
                ...prev,
                ...data,
              }));
            } catch (parseError) {
              console.error("Error parsing final JSON:", parseError);
            }
          }

          break;
        } catch (streamError) {
          retryCount++;
          if (retryCount >= maxRetries) {
            throw streamError;
          }

          addLiveUpdate(
            `Stream error (retry ${retryCount}/${maxRetries}): ${streamError.message}`,
            "warning"
          );

          await new Promise((resolve) =>
            setTimeout(resolve, 2000 * retryCount)
          );
        }
      }
    } catch (err) {
      addLiveUpdate("Upload failed: " + err.message, "error");
      setIsProcessing(false);
      setError("Upload failed: " + err.message);

      setProcessingData((prev) => ({
        ...prev,
        status: "failed",
        endTime: new Date(),
        duration: `${((new Date() - prev.startTime) / 1000).toFixed(2)}s`,
      }));
    }
  };

  // Updated CSV template for AMC Contract
  const csvContent = `Sales Doc,Start Date,End Date,SA Type,Serial Number,Material Code
,,,,,
,,,,,
,,,,,`;

  const handleDownload = () => {
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "amc_contract_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const resetForm = () => {
    setFile(null);
    setError("");
    setActiveTab("upload");
    setLiveUpdates([]);
    setIsProcessing(false);
    setProcessingData({
      status: "idle",
      startTime: null,
      endTime: null,
      duration: null,
      totalRecords: 0,
      processedRecords: 0,
      successfulRecords: 0,
      failedRecords: 0,
      results: [],
      summary: {
        created: 0,
        updated: 0,
        failed: 0,
        duplicatesInFile: 0,
        existingRecords: 0,
        skippedTotal: 0,
      },
      headerMapping: {},
      errors: [],
      warnings: [],
      batchProgress: {
        currentBatch: 0,
        totalBatches: 0,
        batchSize: 1000,
        currentBatchRecords: 0,
      }
    });
  };

  const renderStatusBadge = (status) => {
    const statusMap = {
      Created: { bg: "bg-green-100", text: "text-green-800", label: "Created" },
      Updated: { bg: "bg-blue-100", text: "text-blue-800", label: "Updated" },
      Failed: { bg: "bg-red-100", text: "text-red-800", label: "Failed" },
      Skipped: {
        bg: "bg-yellow-100",
        text: "text-yellow-800",
        label: "Skipped",
      },
      Processing: {
        bg: "bg-blue-100",
        text: "text-blue-800",
        label: "Processing",
      },
    };

    const config = statusMap[status] || {
      bg: "bg-gray-100",
      text: "text-gray-800",
      label: "Unknown",
    };

    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}
      >
        {config.label}
      </span>
    );
  };

  const getProcessingSteps = () => {
    const steps = [
      {
        id: 1,
        title: "File Upload & Validation",
        description: "Validating file format and headers",
        status: processingData.status !== "idle" ? "completed" : "pending",
      },
      {
        id: 2,
        title: "Header Mapping",
        description:
          Object.keys(processingData.headerMapping).length > 0
            ? `Mapped: ${Object.keys(processingData.headerMapping).join(", ")}`
            : "Detecting Sales Doc and Serial Number columns",
        status:
          Object.keys(processingData.headerMapping).length > 0
            ? "completed"
            : processingData.status === "processing"
            ? "active"
            : "pending",
      },
      {
        id: 3,
        title: "Batch Processing AMC Contract Records",
        description: processingData.batchProgress.totalBatches > 0
          ? `Batch ${processingData.batchProgress.currentBatch}/${processingData.batchProgress.totalBatches} - ${processingData.processedRecords}/${processingData.totalRecords} records processed`
          : `${processingData.processedRecords}/${processingData.totalRecords} records processed`,
        status:
          processingData.processedRecords > 0
            ? processingData.processedRecords === processingData.totalRecords
              ? "completed"
              : "active"
            : processingData.status === "processing"
            ? "active"
            : "pending",
      },
      {
        id: 4,
        title: "Finalizing Process",
        description: processingData.batchProgress.totalBatches > 0
          ? `Completed ${processingData.batchProgress.totalBatches} batches - Finalizing AMC Contract bulk upload`
          : "Completing AMC Contract bulk upload operation",
        status: processingData.status === "completed" ? "completed" : "pending",
      },
    ];

    return steps;
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col border border-gray-200">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-blue-50 to-indigo-50 p-6 text-black">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Database size={24} />
                </div>
                Bulk AMC Contract Upload
              </h2>
              <p className="text-gray-500 mt-1">
                Import and manage AMC contract data efficiently with batch processing
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors disabled:opacity-50"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Template Download Section */}
        <div className="flex m-3 justify-between items-center p-4 bg-blue-50 rounded-xl border border-blue-200">
          <div>
            <h3 className="font-semibold text-blue-900">Need a template?</h3>
            <p className="text-sm text-blue-700">
              Download our CSV template with all required columns: Sales Doc,
              Serial Number, Start Date, End Date, SA Type, Material Code
            </p>
          </div>
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Download size={16} />
            Download Template
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Tabs */}
          <div className="mb-6">
            <div className="flex border-b border-gray-200">
              <button
                className={`px-6 py-3 font-medium text-sm transition-colors ${
                  activeTab === "upload"
                    ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                    : "text-gray-500 hover:text-gray-700"
                }`}
                onClick={() => setActiveTab("upload")}
              >
                Upload
                {isProcessing && (
                  <span className="ml-2 inline-flex items-center justify-center w-4 h-4 text-xs bg-blue-600 text-white rounded-full animate-pulse">
                    !
                  </span>
                )}
              </button>
              <button
                className={`px-6 py-3 font-medium text-sm transition-colors ${
                  activeTab === "results"
                    ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                    : "text-gray-500 hover:text-gray-700"
                }`}
                onClick={() => setActiveTab("results")}
                disabled={processingData.status !== "completed"}
              >
                Results
                {processingData.status === "completed" && (
                  <span className="ml-2 inline-flex items-center justify-center w-4 h-4 text-xs bg-green-600 text-white rounded-full">
                    ✓
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Upload Tab */}
          {activeTab === "upload" && (
            <div className="space-y-6 h-[400px] overflow-y-auto">
              {/* File Upload Section */}
              {!isProcessing && (
                <div className="space-y-6">
                  {error && (
                    <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md flex items-start gap-3">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-red-500 flex-shrink-0 mt-0.5"
                      >
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                      </svg>
                      <div>
                        <h3 className="text-sm font-medium text-red-800">
                          Error
                        </h3>
                        <p className="text-sm text-red-700 mt-1">{error}</p>
                      </div>
                    </div>
                  )}

                  <div
                    className={`relative border-2 border-dashed h-[250px] rounded-lg transition-all duration-200 ${
                      isDragging
                        ? "border-blue-500 bg-blue-50 scale-105"
                        : file
                        ? "border-green-500 bg-green-50"
                        : "border-gray-300 hover:border-gray-400"
                    }`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    <div className="flex flex-col items-center justify-center py-12">
                      {file ? (
                        <div className="flex flex-col items-center gap-4">
                          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-green-100">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="32"
                              height="32"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="text-green-600"
                            >
                              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
                              <polyline points="14 2 14 8 20 8"></polyline>
                            </svg>
                          </div>
                          <div className="text-center">
                            <div className="flex items-center gap-2 justify-center">
                              <span className="font-medium text-lg">
                                {file.name}
                              </span>
                              <button
                                className="h-8 w-8 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setFile(null);
                                }}
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="16"
                                  height="16"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <line x1="18" y1="6" x2="6" y2="18"></line>
                                  <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                              </button>
                            </div>
                            <span className="text-sm text-gray-500 mt-2 block">
                              {(file.size / 1024).toFixed(2)} KB
                            </span>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-4">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="32"
                              height="32"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="text-blue-600"
                            >
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                              <polyline points="17 8 12 3 7 8"></polyline>
                              <line x1="12" y1="3" x2="12" y2="15"></line>
                            </svg>
                          </div>
                          <p className="mb-2 text-lg text-center">
                            <span className="font-semibold">
                              Click to upload
                            </span>{" "}
                            or drag and drop
                          </p>
                          <p className="text-sm text-center text-gray-500">
                            CSV or Excel files only (max 50MB)
                          </p>
                          <p className="text-xs text-center text-blue-600 mt-2">
                            Required columns: Sales Doc, Serial Number
                          </p>
                          <p className="text-xs text-center text-gray-600 mt-1">
                            Optional: Start Date, End Date, SA Type, Material Code
                          </p>
                        </>
                      )}
                    </div>
                    <input
                      id="file-upload"
                      type="file"
                      className="hidden"
                      accept=".csv,.xls,.xlsx"
                      onChange={handleFileChange}
                    />
                    <label
                      htmlFor="file-upload"
                      className="absolute inset-0 cursor-pointer"
                    >
                      <span className="sr-only">Upload file</span>
                    </label>
                  </div>

                  <div className="flex justify-end gap-3">
                    {file && (
                      <button
                        onClick={resetForm}
                        className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        Reset
                      </button>
                    )}
                    <button
                      onClick={handleUpload}
                      disabled={!file}
                      className={`px-6 py-3 rounded-lg flex items-center gap-2 ${
                        !file
                          ? "bg-blue-400 cursor-not-allowed"
                          : "bg-blue-600 hover:bg-blue-700"
                      } text-white transition-colors`}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="17 8 12 3 7 8"></polyline>
                        <line x1="12" y1="3" x2="12" y2="15"></line>
                      </svg>
                      Start Batch Upload AMC Contracts
                    </button>
                  </div>
                </div>
              )}

              {/* Processing Status Section */}
              {isProcessing && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Processing Steps */}
                  <div className="lg:col-span-2 space-y-6">
                    <div className="bg-gray-50 rounded-lg p-6">
                      <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                        <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                        Batch Processing Status
                      </h3>
                      
                      {/* Batch Progress Indicator */}
                      {processingData.batchProgress.totalBatches > 0 && (
                        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium text-blue-800">
                              Batch Progress
                            </span>
                            <span className="text-sm text-blue-600">
                              {processingData.batchProgress.currentBatch}/{processingData.batchProgress.totalBatches}
                            </span>
                          </div>
                          <div className="w-full bg-blue-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                              style={{
                                width: `${(processingData.batchProgress.currentBatch / processingData.batchProgress.totalBatches) * 100}%`
                              }}
                            ></div>
                          </div>
                          <div className="text-xs text-blue-600 mt-1">
                            Processing {processingData.batchProgress.batchSize} records per batch
                          </div>
                        </div>
                      )}
                      
                      <div className="space-y-4">
                        {getProcessingSteps().map((step) => (
                          <div key={step.id} className="flex items-start gap-4">
                            <div className="flex-shrink-0 mt-1">
                              <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                                  step.status === "completed"
                                    ? "bg-green-500 text-white"
                                    : step.status === "active"
                                    ? "bg-blue-500 text-white"
                                    : "bg-gray-200 text-gray-500"
                                }`}
                              >
                                {step.status === "completed" ? (
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-4 w-4"
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                ) : step.status === "active" ? (
                                  <svg
                                    className="animate-spin h-4 w-4"
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                  >
                                    <circle
                                      className="opacity-25"
                                      cx="12"
                                      cy="12"
                                      r="10"
                                      stroke="currentColor"
                                      strokeWidth="4"
                                    ></circle>
                                    <path
                                      className="opacity-75"
                                      fill="currentColor"
                                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                    ></path>
                                  </svg>
                                ) : (
                                  step.id
                                )}
                              </div>
                            </div>
                            <div className="flex-1">
                              <h4
                                className={`font-medium ${
                                  step.status === "active"
                                    ? "text-blue-600"
                                    : "text-gray-800"
                                }`}
                              >
                                {step.title}
                              </h4>
                              <p className="text-sm text-gray-600 mt-1">
                                {step.description}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Live Updates */}
                  <div className="space-y-6">
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <h4 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        Real-time Updates
                      </h4>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {liveUpdates.length > 0 ? (
                          liveUpdates.map((update) => (
                            <div
                              key={update.id}
                              className={`p-2 rounded text-xs ${
                                update.type === "error"
                                  ? "bg-red-50 text-red-700"
                                  : update.type === "success"
                                  ? "bg-green-50 text-green-700"
                                  : update.type === "warning"
                                  ? "bg-yellow-50 text-yellow-700"
                                  : "bg-blue-50 text-blue-700"
                              }`}
                            >
                              <div className="flex justify-between items-start">
                                <span>{update.message}</span>
                                <span className="text-gray-500 ml-2">
                                  {update.timestamp}
                                </span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-sm text-gray-500 text-center py-4">
                            Batch processing will start soon...
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Results Tab */}
          {activeTab === "results" && processingData.status === "completed" && (
            <div className="space-y-6 h-[400px] overflow-y-auto px-2">
              {/* Summary Cards - 5 cards layout for AMC Contract */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="bg-gradient-to-r from-green-50 to-green-100 border border-green-200 rounded-lg p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-green-700">
                        Records Created
                      </p>
                      <p className="text-2xl font-bold text-green-800 mt-2">
                        {processingData.summary.created}
                      </p>
                    </div>
                    <div className="bg-green-200 p-2 rounded-full">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-6 w-6 text-green-700"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                        />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-blue-700">
                        Records Updated
                      </p>
                      <p className="text-2xl font-bold text-blue-800 mt-2">
                        {processingData.summary.updated}
                      </p>
                    </div>
                    <div className="bg-blue-200 p-2 rounded-full">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-6 w-6 text-blue-700"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-orange-50 to-orange-100 border border-orange-200 rounded-lg p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-orange-700">
                        File Duplicates
                      </p>
                      <p className="text-2xl font-bold text-orange-800 mt-2">
                        {processingData.summary.duplicatesInFile}
                      </p>
                    </div>
                    <div className="bg-orange-200 p-2 rounded-full">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-6 w-6 text-orange-700"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-200 rounded-lg p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700">
                        Existing Records
                      </p>
                      <p className="text-2xl font-bold text-gray-800 mt-2">
                        {processingData.summary.existingRecords}
                      </p>
                    </div>
                    <div className="bg-gray-200 p-2 rounded-full">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-6 w-6 text-gray-700"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-red-50 to-red-100 border border-red-200 rounded-lg p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-red-700">
                        Failed Records
                      </p>
                      <p className="text-2xl font-bold text-red-800 mt-2">
                        {processingData.summary.failed}
                      </p>
                    </div>
                    <div className="bg-red-200 p-2 rounded-full">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-6 w-6 text-red-700"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Processing Summary */}
              {processingData.duration && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-medium text-sm text-gray-800 mb-2">
                    Batch Processing Summary
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Total Records:</span>
                      <span className="ml-2 font-medium">
                        {processingData.totalRecords}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Total Batches:</span>
                      <span className="ml-2 font-medium">
                        {processingData.batchProgress.totalBatches || 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Processing Time:</span>
                      <span className="ml-2 font-medium">
                        {processingData.duration}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Total Skipped:</span>
                      <span className="ml-2 font-medium">
                        {processingData.summary.skippedTotal}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Completed At:</span>
                      <span className="ml-2 font-medium">
                        {new Date(processingData.endTime).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Detailed Results */}
              <div className="bg-white border border-gray-200 rounded-lg">
                <div className="p-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-800">
                    Detailed Results ({filteredResults.length} records)
                  </h3>
                </div>
                {/* Result Tabs */}
                <div className="border-b border-gray-200 mb-4">
                  <nav className="flex -mb-px">
                    {filterTabs.map((tab) => (
                      <button
                        key={tab.value}
                        onClick={() => setResultFilter(tab.value)}
                        className={`whitespace-nowrap px-4 py-2 text-sm font-medium border-b-2 ${
                          resultFilter === tab.value
                            ? "border-blue-600 text-blue-600"
                            : "border-transparent text-gray-500 hover:text-gray-700"
                        }`}
                      >
                        {tab.label}
                        <span className="ml-2 inline-block rounded-full px-2 bg-gray-100 text-xs text-gray-600">
                          {tab.count}
                        </span>
                      </button>
                    ))}
                  </nav>
                </div>

                <div className="max-h-80 overflow-y-auto">
                  {processingData.results.length > 0 ? (
                    <div className="divide-y divide-gray-100">
                      {filteredResults.map((item, index) => (
                        <div
                          key={index}
                          className="p-4 hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs text-gray-500">
                                  Row {item.row}
                                </span>
                                <span className="text-sm font-medium text-gray-800">
                                  {item.serialnumber}
                                </span>
                              </div>
                              <div className="text-sm text-gray-600 mb-1">
                                Sales Doc: {item.salesdoc || "N/A"}
                              </div>
                              {item.action && (
                                <div className="text-xs text-blue-600">
                                  {item.action}
                                </div>
                              )}
                              {item.error && (
                                <div className="text-xs text-red-500 mt-1">
                                  Error: {item.error}
                                </div>
                              )}
                              {item.warnings && item.warnings.length > 0 && (
                                <div className="text-xs text-yellow-600 mt-1">
                                  Warnings: {item.warnings.join(", ")}
                                </div>
                              )}
                            </div>
                            <div className="ml-4">
                              {renderStatusBadge(item.status)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-gray-500">
                      No results to display
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end pb-4 gap-3">
                <button
                  onClick={resetForm}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Upload Another File
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AMCContractBulk;
