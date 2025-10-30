// Wrapper to ensure jsPDF is available in the global scope
// The UMD build exports to window.jspdf.jsPDF
(function() {
  // Wait for jsPDF to be available
  if (typeof window.jspdf !== 'undefined' && typeof window.jspdf.jsPDF !== 'undefined') {
    // Also expose it directly as window.jsPDF for easier access
    window.jsPDF = window.jspdf.jsPDF;
  } else {
    console.error('jsPDF library failed to load');
  }
})();
