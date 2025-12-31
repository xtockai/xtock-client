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
  const [countryCode, setCountryCode] = useState("+1");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  console.log("restaurant ", restaurant);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);
    try {
      const res = await fetch("/api/demo-whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurant,
          phone: countryCode + phone,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(true);
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
        Enter your WhatsApp number to receive a forecast message for your
        restaurant. Experience Xtock in action!
      </p>
      <form
        className="flex flex-col items-center gap-4 w-full max-w-md bg-white p-6 rounded-lg shadow-lg"
        onSubmit={handleSubmit}
      >
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
            placeholder="WhatsApp number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            pattern="[0-9]{7,15}"
            autoComplete="tel"
          />
        </div>
        <button
          type="submit"
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 rounded transition disabled:opacity-60"
          disabled={loading || !phone}
        >
          {loading ? "Sending..." : "Send Forecast to WhatsApp"}
        </button>
        {success && (
          <div className="text-green-600 font-medium">
            Message sent! Check your WhatsApp.
          </div>
        )}
        {error && <div className="text-red-500 font-medium">{error}</div>}
      </form>
    </main>
  );
};

export default DemoPage;
