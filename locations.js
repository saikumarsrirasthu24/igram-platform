// ═══ iGram Location Master — Telangana, Maharashtra, Andhra Pradesh ═══
// Used by backend (matching) and exposed to frontend (dropdowns) via /api/locations
const LOCATIONS = {
  "Telangana": {
    "Hyderabad":   ["Secunderabad", "Charminar", "Kukatpally", "LB Nagar", "Serilingampally"],
    "Warangal":    ["Warangal Urban", "Hanamkonda", "Kazipet", "Narsampet", "Parkal"],
    "Nalgonda":    ["Nalgonda", "Miryalaguda", "Suryapet", "Devarakonda", "Bhongir"],
    "Karimnagar":  ["Karimnagar", "Huzurabad", "Jagtial", "Sircilla", "Manthani"],
    "Khammam":     ["Khammam", "Kothagudem", "Palwancha", "Madhira", "Sathupally"],
    "Nizamabad":   ["Nizamabad", "Bodhan", "Armoor", "Kamareddy", "Banswada"]
  },
  "Maharashtra": {
    "Pune":        ["Haveli", "Shirur", "Baramati", "Maval", "Mulshi"],
    "Nashik":      ["Nashik", "Malegaon", "Sinnar", "Niphad", "Igatpuri"],
    "Aurangabad":  ["Aurangabad", "Gangapur", "Paithan", "Vaijapur", "Sillod"],
    "Nagpur":      ["Nagpur Urban", "Nagpur Rural", "Kamptee", "Katol", "Umred"],
    "Solapur":     ["Solapur North", "Solapur South", "Pandharpur", "Barshi", "Akkalkot"]
  },
  "Andhra Pradesh": {
    "Vijayawada":  ["Vijayawada Urban", "Vijayawada Rural", "Nandigama", "Tiruvuru", "Jaggayyapeta"],
    "Guntur":      ["Guntur East", "Guntur West", "Tenali", "Bapatla", "Narasaraopet"],
    "Visakhapatnam":["Visakhapatnam", "Gajuwaka", "Bheemunipatnam", "Anakapalle", "Narsipatnam"],
    "Tirupati":    ["Tirupati", "Chandragiri", "Srikalahasti", "Puttur", "Satyavedu"],
    "Kurnool":     ["Kurnool", "Adoni", "Nandyal", "Yemmiganur", "Dhone"]
  }
};

const CROP_TYPES = ["Paddy / Rice", "Cotton", "Maize", "Sugarcane", "Groundnut", "Soybean",
  "Red Gram (Tur)", "Green Gram", "Chilli", "Turmeric", "Vegetables", "Other"];

const EQUIPMENT_TYPES = ["Tractor", "Rotavator", "Drone Spray", "Harvester", "Boom Sprayer",
  "Thresher", "Seed Drill", "Cultivator", "Plough", "Power Tiller", "Other"];

const GOVT_SERVICES = ["PM-Kisan Registration", "Aadhaar Update", "Soil Health Card",
  "Crop Insurance (PMFBY)", "Caste Certificate", "Income Certificate", "Land Records (Pahani)",
  "Ration Card", "Pension Scheme", "Scholarship Application", "Bank Account Opening", "Other"];

module.exports = { LOCATIONS, CROP_TYPES, EQUIPMENT_TYPES, GOVT_SERVICES };
