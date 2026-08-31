/**
 * 👑 Invovo ERP HIGH-PERFORMANCE GLOBAL UTILITY ENGINE
 */



// A. Standardized Secure User Friendly Masked Error Messages
export const getSafeErrorMessage = (err) => {
  console.error("🔒 SYSTEM TECHNICAL LOG:", err); // dev console main real error rahega
  return "System operational delay detected. Please check your internet connectivity or contact Invovo Support.";
};

// B. Centralized WhatsApp API Failover Router with Fallback URL Encoding
export const dispatchWhatsAppMessage = (phone, textMessage) => {
  const cleanPhone = "92" + String(phone || "").replace(/\D/g, '').replace(/^0/, '');
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const waBase = isMobile ? 'whatsapp://send' : 'https://web.whatsapp.com/send';
  
  window.open(`${waBase}?phone=${cleanPhone}&text=${encodeURIComponent(textMessage)}`, '_blank');
};

// C. Optimized Submission-Time Phone Formatter
export const sanitizePhoneNumber = (phoneStr) => {
  return String(phoneStr || "").replace(/\D/g, '').substring(0, 11);
};

