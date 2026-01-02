"use client";
import React, { useState } from "react";
import Image from "next/image";

const countryCodes = [
  { code: "+1", country: "US" },
  { code: "+44", country: "UK" },
  { code: "+57", country: "CO" },
  { code: "+34", country: "ES" },
  { code: "+49", country: "DE" },
  { code: "+33", country: "FR" },
  { code: "+39", country: "IT" },
  { code: "+55", country: "BR" },
  { code: "+52", country: "MX" },
  { code: "+91", country: "IN" },
  { code: "+81", country: "JP" },
  { code: "+86", country: "CN" },
  { code: "+7", country: "RU" },
  { code: "+61", country: "AU" },
  { code: "+351", country: "PT" },
  { code: "+90", country: "TR" },
  { code: "+82", country: "KR" },
  { code: "+62", country: "ID" },
  { code: "+234", country: "NG" },
  { code: "+27", country: "ZA" },
  { code: "+966", country: "SA" },
  { code: "+972", country: "IL" },
  { code: "+48", country: "PL" },
  { code: "+420", country: "CZ" },
  { code: "+36", country: "HU" },
  { code: "+358", country: "FI" },
  { code: "+46", country: "SE" },
  { code: "+47", country: "NO" },
  { code: "+45", country: "DK" },
  { code: "+63", country: "PH" },
  { code: "+65", country: "SG" },
  { code: "+64", country: "NZ" },
  // Add more as needed
];

interface DemoPageProps {
  restaurant: string;
}

const DemoPage: React.FC<DemoPageProps> = ({ restaurant }) => {
  const [activeTab, setActiveTab] = useState<'sms' | 'email'>('sms');
  const [countryCode, setCountryCode] = useState("+1");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);
    setSuccessMessage("");

    try {
      const endpoint = activeTab === 'email' ? '/api/demo-email' : '/api/demo-whatsapp';
      const body = activeTab === 'email'
        ? { restaurant, email }
        : { restaurant, phone: countryCode + phone };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(true);
        setSuccessMessage(data.message || "Message sent!");
      } else {
        setError(data.error || "Failed to send message");
      }
    } catch (err) {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4">
      <div className="flex items-center mb-6">
        <Image
          src={"/logo1.png"}
          alt="Xtock"
          width={40}
          height={40}
          className="object-contain"
        />
        <span className="text-2xl font-bold text-gray-800 bg-clip-text mt-1">
          tock
        </span>
      </div>

      <h1 className="text-3xl font-bold mb-2 text-indigo-900">
        {restaurant} Demo
      </h1>
      <p className="mb-6 text-gray-600 text-center max-w-md">
        Choose how to receive your forecast message. Experience Xtock in action!
      </p>

      {/* Tabs */}
      <div className="flex w-full max-w-md mb-4">
        <button
          type="button"
          onClick={() => setActiveTab('sms')}
          className={`flex-1 py-2 px-4 text-center font-medium rounded-l-lg border transition ${
            activeTab === 'sms'
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }`}
        >
          📱 SMS
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('email')}
          className={`flex-1 py-2 px-4 text-center font-medium rounded-r-lg border-t border-r border-b transition ${
            activeTab === 'email'
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }`}
        >
          ✉️ Email
        </button>
      </div>

      <form
        className="flex flex-col items-center gap-4 w-full max-w-md bg-white p-6 rounded-lg shadow-lg"
        onSubmit={handleSubmit}
      >
        {activeTab === 'sms' ? (
          <div className="flex w-full gap-2 items-center">
            <select
              className="border rounded-l-md px-3 py-2 bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              style={{ minWidth: 90 }}
            >
              {countryCodes.map(({ code, country }) => (
                <option key={code} value={code}>
                  {country} {code}
                </option>
              ))}
            </select>
            <input
              type="tel"
              className="border rounded-r-md px-3 py-2 flex-1 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              placeholder="Phone number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              pattern="[0-9]{7,15}"
              autoComplete="tel"
            />
          </div>
        ) : (
          <input
            type="email"
            className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        )}

        <button
          type="submit"
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 rounded transition disabled:opacity-60"
          disabled={loading || (activeTab === 'sms' ? !phone : !email)}
        >
          {loading ? "Sending..." : `Send Forecast via ${activeTab === 'sms' ? 'SMS' : 'Email'}`}
        </button>
        {success && (
          <div className="text-green-600 font-medium">
            {successMessage}
          </div>
        )}
        {error && <div className="text-red-500 font-medium">{error}</div>}
      </form>
    </main>
  );
};

export default DemoPage;
