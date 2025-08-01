import React, { useEffect, useState, useCallback } from "react";
import FormControl from "@mui/joy/FormControl";
import Input from "@mui/joy/Input";
import SearchIcon from "@mui/icons-material/Search";
import Swal from "sweetalert2";
import axios from "axios";
import moment from "moment";

function OnCallCNoteDelete() {
  /* ───────────────────────── STATES ───────────────────────── */
  const [data, setData] = useState([]);
  const [filteredData, setFiltered] = useState([]);
  const [loader, setLoader] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");

  const limit = 10;

  /* ───────────────────────── API CALLS ───────────────────────── */
  const getAllData = useCallback(() => {
    setLoader(true);
    axios
      .get(
        `${process.env.REACT_APP_BASE_URL}/phone/oncall-cnote?page=${page}&limit=${limit}`
      )
      .then((res) => {
        setLoader(false);
        const rows = res.data.data || res.data;
        const pagesCount =
          res.data.totalPages || Math.ceil((res.data.length || 0) / limit);

        setData(rows);
        setFiltered(rows);
        setTotalPages(pagesCount);
      })
      .catch((err) => {
        console.error(err);
        setLoader(false);
      });
  }, [page]);

  useEffect(() => {
    getAllData();
  }, [getAllData]);

  /* ───────────────────────── DELETE ───────────────────────── */
  const handleDelete = (cnoteNumber) => {
    Swal.fire({
      title: "Delete Permanently?",
      text: `OnCall C-Note ${cnoteNumber} will be removed!`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, delete it!",
    }).then((result) => {
      if (result.isConfirmed) {
        axios
          .delete(
            `${process.env.REACT_APP_BASE_URL}/phone/oncall-cnote/${cnoteNumber}`
          )
          .then(() => {
            Swal.fire("Deleted!", "OnCall C-Note deleted.", "success");
            getAllData();
          })
          .catch((err) => {
            console.error(err);
            Swal.fire("Error!", "Failed to delete.", "error");
          });
      }
    });
  };

  /* ───────────────────────── SEARCH ───────────────────────── */
  const handleSearch = () => {
    if (!searchQuery.trim()) {
      setFiltered(data);
      return;
    }

    const query = searchQuery.toLowerCase();

    const filtered = data.filter((row) => {
      return (
        row.cnoteNumber?.toLowerCase().includes(query) ||
        row.onCallNumber?.toLowerCase().includes(query) ||
        row.customer?.customername?.toLowerCase().includes(query) ||
        row.status?.toLowerCase().includes(query) ||
        row.complaint?.notification_complaintid
          ?.toLowerCase()
          .includes(query) ||
        row.complaint?.materialdescription?.toLowerCase().includes(query)
      );
    });

    setFiltered(filtered);
  };

  /* ───────────────────────── HELPERS ───────────────────────── */
  const getRevisionStatus = (row) => {
    if (!row.revisions || row.revisions.length === 0) {
      return {
        status: row.status || "draft",
        color: "bg-gray-100 text-gray-800",
      };
    }

    const currentRev = row.revisions.find(
      (r) => r.revisionNumber === row.currentRevision
    );
    const status = currentRev?.status || row.status || "draft";

    const colorMap = {
      approved: "bg-green-100 text-green-800",
      pending: "bg-yellow-100 text-yellow-800",
      rejected: "bg-red-100 text-red-800",
      issued: "bg-blue-100 text-blue-800",
      cancelled: "bg-red-100 text-red-800",
      draft: "bg-gray-100 text-gray-800",
    };

    return { status, color: colorMap[status] || "bg-gray-100 text-gray-800" };
  };

  const getTotalSpares = (spares) => {
    return spares?.length || 0;
  };

  const getApprovalStatus = (row) => {
    const rsh = row.RSHApproval?.approved;
    const nsh = row.NSHApproval?.approved;

    if (rsh && nsh) return { text: "Both Approved", color: "text-green-600" };
    if (rsh) return { text: "RSH Only", color: "text-orange-600" };
    if (nsh) return { text: "NSH Only", color: "text-orange-600" };
    return { text: "Pending", color: "text-red-600" };
  };

  /* ───────────────────────── PAGINATION ───────────────────────── */
  const handlePrev = () => page > 1 && setPage((p) => p - 1);
  const handleNext = () => page < totalPages && setPage((p) => p + 1);

  /* ───────────────────────── RENDER ───────────────────────── */
  return loader ? (
    <div className="flex items-center justify-center h-[60vh]">
      <span className="CustomLoader" />
    </div>
  ) : (
    <>
      {/* TOP-BAR */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex gap-3 w-full md:w-auto">
          <FormControl sx={{ flex: 1 }} size="sm">
            <Input
              size="sm"
              placeholder="Search C-Note / OnCall / Customer / Complaint / Device..."
              startDecorator={<SearchIcon />}
              value={searchQuery}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </FormControl>
          <button
            onClick={handleSearch}
            className="px-5 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded text-sm font-medium"
          >
            Search
          </button>
        </div>

        <button className="px-5 py-1.5 bg-blue-700 text-white rounded text-sm font-medium">
          Filter
        </button>
      </div>

      {/* TABLE */}
      <div className="relative w-full overflow-x-auto border rounded shadow-sm">
        <table className="w-full text-sm min-w-max">
          <thead className="bg-blue-700 text-white">
            <tr>
              <th className="p-3 text-left">
                <input type="checkbox" className="w-4 h-4" />
              </th>
              <th className="p-3 text-left font-medium">C-Note No.</th>
              <th className="p-3 text-left font-medium">OnCall No.</th>
              <th className="p-3 text-left font-medium">Customer</th>
              <th className="p-3 text-left font-medium">Device</th>
              <th className="p-3 text-left font-medium">Complaint ID</th>
              <th className="p-3 text-left font-medium">Spares</th>
              <th className="p-3 text-left font-medium">Current Rev</th>
              <th className="p-3 text-left font-medium">Rev Status</th>
              <th className="p-3 text-left font-medium">Approvals</th>
              <th className="p-3 text-left font-medium">Final Amount</th>
              <th className="p-3 text-left font-medium">Created</th>
              <th className="p-3 text-left font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((row, idx) => {
              const revisionStatus = getRevisionStatus(row);
              const approvalStatus = getApprovalStatus(row);

              return (
                <tr key={row._id} className="border-b hover:bg-gray-50">
                  <td className="p-3">
                    <input
                      type="checkbox"
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                  </td>

                  <td className="p-3 font-bold text-blue-600">
                    {row.cnoteNumber}
                  </td>

                  <td className="p-3 font-semibold">{row.onCallNumber}</td>

                  <td className="p-3">
                    <div>
                      <div className="font-medium capitalize">
                        {row.customer?.customername}
                      </div>
                      <div className="text-xs text-gray-500">
                        {row.customer?.city}
                      </div>
                    </div>
                  </td>

                  <td className="p-3">
                    <div className="max-w-32">
                      <div
                        className="font-medium text-xs truncate"
                        title={row.complaint?.materialdescription}
                      >
                        {row.complaint?.materialdescription}
                      </div>
                      <div className="text-xs text-gray-500">
                        S/N: {row.complaint?.serialnumber}
                      </div>
                    </div>
                  </td>

                  <td className="p-3 font-mono text-xs">
                    {row.complaint?.notification_complaintid}
                  </td>

                  <td className="p-3 text-center">
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">
                      {getTotalSpares(row.spares)}
                    </span>
                  </td>

                  <td className="p-3 text-center">
                    <span className="bg-indigo-100 text-indigo-800 px-2 py-1 rounded text-xs font-medium">
                      Rev {row.currentRevision || 0}
                    </span>
                  </td>

                  <td className="p-3">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${revisionStatus.color}`}
                    >
                      {revisionStatus.status}
                    </span>
                  </td>

                  <td className="p-3">
                    <span
                      className={`text-xs font-medium ${approvalStatus.color}`}
                    >
                      {approvalStatus.text}
                    </span>
                  </td>

                  <td className="p-3 font-semibold text-green-600">
                    ₹{row.finalAmount?.toLocaleString("en-IN") || "0"}
                  </td>

                  <td className="p-3">
                    <div className="text-xs">
                      <div>{moment(row.createdAt).format("MMM D, YYYY")}</div>
                      <div className="text-gray-500">
                        {moment(row.createdAt).format("h:mm A")}
                      </div>
                    </div>
                  </td>

                  <td className="p-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDelete(row.cnoteNumber)}
                        className="p-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                        title="Delete OnCall C-Note"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          fill="currentColor"
                          className="bi bi-trash3-fill"
                          viewBox="0 0 16 16"
                        >
                          <path d="M11 1.5v1h3.5a.5.5 0 0 1 0 1h-.538l-.853 10.66A2 2 0 0 1 11.115 16h-6.23a2 2 0 0 1-1.994-1.84L2.038 3.5H1.5a.5.5 0 0 1 0-1H5v-1A1.5 1.5 0 0 1 6.5 0h3A1.5 1.5 0 0 1 11 1.5m-5 0v1h4v-1a.5.5 0 0 0-.5-.5h-3a.5.5 0 0 0-.5.5M4.5 5.029l.5 8.5a.5.5 0 1 0 .998-.06l-.5-8.5a.5.5 0 1 0-.998.06m6.53-.528a.5.5 0 0 0-.528.47l-.5 8.5a.5.5 0 0 0 .998.058l.5-8.5a.5.5 0 0 0-.47-.528M8 4.5a.5.5 0 0 0-.5.5v8.5a.5.5 0 0 0 1 0V5a.5.5 0 0 0-.5-.5" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {filteredData.length === 0 && (
              <tr>
                <td colSpan={13} className="text-center py-8 text-gray-500">
                  <div className="flex flex-col items-center gap-2">
                    <svg
                      className="w-12 h-12 text-gray-300"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <p>No OnCall C-Notes found</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* PAGINATION */}
      <div className="flex items-center justify-between mt-6 px-2">
        <div className="text-sm text-gray-600">
          Showing {filteredData.length} of {data.length} entries
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrev}
            disabled={page === 1}
            className={`px-4 py-2 border rounded-lg font-medium transition-colors ${
              page === 1
                ? "cursor-not-allowed bg-gray-100 text-gray-400 border-gray-200"
                : "hover:bg-gray-50 text-gray-700 border-gray-300"
            }`}
          >
            Previous
          </button>

          <div className="flex gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(
                (p) =>
                  p === 1 ||
                  p === totalPages ||
                  (p >= page - 2 && p <= page + 2)
              )
              .map((p, idx, arr) => (
                <React.Fragment key={p}>
                  {idx > 0 && p !== arr[idx - 1] + 1 && (
                    <span className="px-2 py-2 text-gray-400">…</span>
                  )}
                  <button
                    onClick={() => setPage(p)}
                    className={`px-3 py-2 rounded-lg font-medium transition-colors ${
                      p === page
                        ? "bg-blue-700 text-white"
                        : "hover:bg-gray-50 text-gray-700 border border-gray-300"
                    }`}
                    disabled={p === page}
                  >
                    {p}
                  </button>
                </React.Fragment>
              ))}
          </div>

          <button
            onClick={handleNext}
            disabled={page === totalPages}
            className={`px-4 py-2 border rounded-lg font-medium transition-colors ${
              page === totalPages
                ? "cursor-not-allowed bg-gray-100 text-gray-400 border-gray-200"
                : "bg-blue-700 text-white hover:bg-blue-800 border-blue-700"
            }`}
          >
            Next
          </button>
        </div>
      </div>
    </>
  );
}

export default OnCallCNoteDelete;
