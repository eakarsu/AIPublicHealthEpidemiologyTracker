const pool = require('./db');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '../.env' });

async function seed() {
  console.log('Seeding database...');

  // Drop and recreate tables
  await pool.query(`
    DROP TABLE IF EXISTS users, outbreaks, vaccinations, contact_tracing, syndromic_surveillance,
      water_quality, air_quality, hospital_capacity, mortality_stats, disease_reports,
      antimicrobial_resistance, vector_diseases, health_equity CASCADE;

    CREATE TABLE users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(50) DEFAULT 'analyst',
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE outbreaks (
      id SERIAL PRIMARY KEY,
      disease_name VARCHAR(255) NOT NULL,
      location VARCHAR(255) NOT NULL,
      cases_count INTEGER DEFAULT 0,
      deaths_count INTEGER DEFAULT 0,
      status VARCHAR(50) DEFAULT 'Active',
      severity VARCHAR(50) DEFAULT 'Medium',
      reported_date DATE,
      description TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE vaccinations (
      id SERIAL PRIMARY KEY,
      vaccine_name VARCHAR(255) NOT NULL,
      target_disease VARCHAR(255),
      region VARCHAR(255),
      doses_administered INTEGER DEFAULT 0,
      target_population INTEGER DEFAULT 0,
      coverage_pct DECIMAL(5,2) DEFAULT 0,
      start_date DATE,
      status VARCHAR(50) DEFAULT 'Active',
      provider VARCHAR(255),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE contact_tracing (
      id SERIAL PRIMARY KEY,
      case_id VARCHAR(50) NOT NULL,
      contact_name VARCHAR(255) NOT NULL,
      relationship VARCHAR(100),
      exposure_date DATE,
      exposure_location VARCHAR(255),
      risk_level VARCHAR(50) DEFAULT 'Medium',
      status VARCHAR(50) DEFAULT 'Monitoring',
      symptoms TEXT,
      phone VARCHAR(50),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE syndromic_surveillance (
      id SERIAL PRIMARY KEY,
      syndrome VARCHAR(255) NOT NULL,
      facility VARCHAR(255),
      region VARCHAR(255),
      case_count INTEGER DEFAULT 0,
      baseline_count INTEGER DEFAULT 0,
      alert_level VARCHAR(50) DEFAULT 'Normal',
      report_date DATE,
      symptoms_description TEXT,
      age_group VARCHAR(50),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE water_quality (
      id SERIAL PRIMARY KEY,
      source_name VARCHAR(255) NOT NULL,
      location VARCHAR(255),
      ph_level DECIMAL(4,2),
      turbidity DECIMAL(6,2),
      contaminant VARCHAR(255),
      contaminant_level DECIMAL(10,4),
      safe_limit DECIMAL(10,4),
      status VARCHAR(50) DEFAULT 'Safe',
      sample_date DATE,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE air_quality (
      id SERIAL PRIMARY KEY,
      station_name VARCHAR(255) NOT NULL,
      location VARCHAR(255),
      aqi_value INTEGER DEFAULT 0,
      pm25 DECIMAL(8,2),
      pm10 DECIMAL(8,2),
      ozone DECIMAL(8,4),
      co_level DECIMAL(8,4),
      category VARCHAR(50) DEFAULT 'Good',
      reading_date DATE,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE hospital_capacity (
      id SERIAL PRIMARY KEY,
      hospital_name VARCHAR(255) NOT NULL,
      region VARCHAR(255),
      total_beds INTEGER DEFAULT 0,
      occupied_beds INTEGER DEFAULT 0,
      icu_total INTEGER DEFAULT 0,
      icu_occupied INTEGER DEFAULT 0,
      ventilators_total INTEGER DEFAULT 0,
      ventilators_in_use INTEGER DEFAULT 0,
      status VARCHAR(50) DEFAULT 'Normal',
      report_date DATE,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE mortality_stats (
      id SERIAL PRIMARY KEY,
      region VARCHAR(255) NOT NULL,
      cause_of_death VARCHAR(255),
      age_group VARCHAR(50),
      gender VARCHAR(20),
      count INTEGER DEFAULT 0,
      population INTEGER DEFAULT 0,
      rate_per_100k DECIMAL(10,2),
      report_date DATE,
      trend VARCHAR(50) DEFAULT 'Stable',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE disease_reports (
      id SERIAL PRIMARY KEY,
      disease_name VARCHAR(255) NOT NULL,
      icd_code VARCHAR(20),
      reporting_facility VARCHAR(255),
      patient_age INTEGER,
      patient_gender VARCHAR(20),
      diagnosis_date DATE,
      report_date DATE,
      severity VARCHAR(50) DEFAULT 'Moderate',
      lab_confirmed BOOLEAN DEFAULT false,
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE antimicrobial_resistance (
      id SERIAL PRIMARY KEY,
      organism VARCHAR(255) NOT NULL,
      antibiotic VARCHAR(255),
      resistance_pattern VARCHAR(100),
      facility VARCHAR(255),
      specimen_type VARCHAR(100),
      mic_value VARCHAR(50),
      interpretation VARCHAR(50),
      test_date DATE,
      patient_age INTEGER,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE vector_diseases (
      id SERIAL PRIMARY KEY,
      disease_name VARCHAR(255) NOT NULL,
      vector_type VARCHAR(100),
      location VARCHAR(255),
      cases_count INTEGER DEFAULT 0,
      season VARCHAR(50),
      habitat_risk VARCHAR(50) DEFAULT 'Medium',
      control_measures TEXT,
      report_date DATE,
      status VARCHAR(50) DEFAULT 'Active',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE health_equity (
      id SERIAL PRIMARY KEY,
      indicator VARCHAR(255) NOT NULL,
      region VARCHAR(255),
      demographic_group VARCHAR(255),
      value DECIMAL(10,2),
      benchmark DECIMAL(10,2),
      disparity_ratio DECIMAL(6,2),
      data_source VARCHAR(255),
      report_date DATE,
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  // Seed users
  const hash = await bcrypt.hash(process.env.DEMO_PASSWORD || 'EpidTracker2024!', 10);
  await pool.query(
    `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4)`,
    ['Dr. Sarah Mitchell', process.env.DEMO_EMAIL || 'admin@healthdept.gov', hash, 'admin']
  );

  // Seed outbreaks (16 items)
  await pool.query(`
    INSERT INTO outbreaks (disease_name, location, cases_count, deaths_count, status, severity, reported_date, description) VALUES
    ('COVID-19 Variant XBB.3', 'Metro District A', 1245, 12, 'Active', 'High', '2026-03-15', 'New subvariant detected with increased transmissibility in urban areas'),
    ('Influenza A H3N2', 'Northern Region', 3420, 28, 'Active', 'High', '2026-03-10', 'Seasonal influenza surge exceeding baseline expectations by 40%'),
    ('Measles', 'Western County', 89, 1, 'Active', 'Medium', '2026-03-20', 'Cluster linked to under-vaccinated community'),
    ('Dengue Fever', 'Coastal Zone B', 567, 5, 'Active', 'High', '2026-02-28', 'Rainy season surge in mosquito-borne transmission'),
    ('Tuberculosis MDR', 'Central District', 34, 3, 'Active', 'Critical', '2026-03-01', 'Multi-drug resistant TB cluster in congregate setting'),
    ('Norovirus', 'Eastern Suburbs', 892, 0, 'Contained', 'Medium', '2026-02-15', 'Foodborne outbreak traced to catering facility'),
    ('Hepatitis A', 'Southern Region', 156, 2, 'Active', 'Medium', '2026-03-05', 'Linked to contaminated water supply'),
    ('Cholera', 'Rural District C', 234, 8, 'Active', 'Critical', '2026-02-20', 'Waterborne outbreak following flooding'),
    ('Pertussis', 'Metro District B', 178, 0, 'Active', 'Low', '2026-03-12', 'Whooping cough increase in school-age children'),
    ('Salmonella Enteritidis', 'Northern Valley', 445, 1, 'Contained', 'Medium', '2026-02-10', 'Multi-state outbreak linked to poultry products'),
    ('Zika Virus', 'Tropical Zone A', 123, 0, 'Monitoring', 'Medium', '2026-03-18', 'Travel-associated cases with local transmission risk'),
    ('Legionnaires Disease', 'Downtown District', 45, 4, 'Active', 'High', '2026-03-08', 'Cluster linked to cooling tower contamination'),
    ('Hand Foot and Mouth Disease', 'Suburban Region', 678, 0, 'Active', 'Low', '2026-03-22', 'Seasonal increase in daycare and school settings'),
    ('Mpox', 'Metro Area', 67, 0, 'Monitoring', 'Medium', '2026-03-14', 'Sporadic cases with community transmission'),
    ('E. coli O157:H7', 'Agricultural Belt', 89, 2, 'Contained', 'High', '2026-02-25', 'Linked to contaminated romaine lettuce'),
    ('RSV', 'Statewide', 2340, 15, 'Active', 'High', '2026-03-01', 'Early season RSV surge affecting infants and elderly')
  `);

  // Seed vaccinations (16 items)
  await pool.query(`
    INSERT INTO vaccinations (vaccine_name, target_disease, region, doses_administered, target_population, coverage_pct, start_date, status, provider) VALUES
    ('Pfizer-BioNTech XBB.3', 'COVID-19', 'Metro District A', 45000, 120000, 37.50, '2026-01-15', 'Active', 'County Health Dept'),
    ('Fluzone Quadrivalent', 'Influenza', 'Northern Region', 89000, 200000, 44.50, '2025-10-01', 'Active', 'State Immunization Program'),
    ('MMR-II', 'Measles/Mumps/Rubella', 'Western County', 12000, 25000, 48.00, '2026-02-01', 'Active', 'Pediatric Alliance'),
    ('Dengvaxia', 'Dengue', 'Coastal Zone B', 8000, 50000, 16.00, '2026-01-20', 'Active', 'Tropical Disease Unit'),
    ('BCG Vaccine', 'Tuberculosis', 'Central District', 5600, 15000, 37.33, '2025-11-01', 'Active', 'TB Control Program'),
    ('Prevnar 20', 'Pneumococcal', 'Southern Region', 34000, 80000, 42.50, '2025-09-15', 'Active', 'Senior Health Initiative'),
    ('Shingrix', 'Shingles', 'Eastern Suburbs', 22000, 60000, 36.67, '2025-08-01', 'Active', 'Pharmacy Network'),
    ('Gardasil 9', 'HPV', 'Statewide', 67000, 150000, 44.67, '2025-07-01', 'Active', 'School Health Program'),
    ('Tdap Booster', 'Tetanus/Pertussis', 'Metro District B', 28000, 75000, 37.33, '2025-11-15', 'Active', 'Primary Care Network'),
    ('Hepatitis A Vaccine', 'Hepatitis A', 'Southern Region', 9500, 30000, 31.67, '2026-02-10', 'Active', 'Outbreak Response Team'),
    ('Oral Cholera Vaccine', 'Cholera', 'Rural District C', 6000, 20000, 30.00, '2026-02-22', 'Active', 'Emergency Response Unit'),
    ('Rabies Vaccine', 'Rabies', 'Rural Areas', 3200, 10000, 32.00, '2025-06-01', 'Active', 'Animal Control Division'),
    ('Yellow Fever Vaccine', 'Yellow Fever', 'Tropical Zone A', 11000, 40000, 27.50, '2025-12-01', 'Active', 'Travel Health Clinic'),
    ('Meningococcal ACWY', 'Meningitis', 'University District', 18000, 35000, 51.43, '2025-08-15', 'Completed', 'Campus Health Services'),
    ('RSV Vaccine (Abrysvo)', 'RSV', 'Statewide', 42000, 100000, 42.00, '2025-09-01', 'Active', 'Maternal Health Program'),
    ('Jynneos', 'Mpox', 'Metro Area', 4500, 15000, 30.00, '2026-01-10', 'Active', 'STI Prevention Unit')
  `);

  // Seed contact tracing (16 items)
  await pool.query(`
    INSERT INTO contact_tracing (case_id, contact_name, relationship, exposure_date, exposure_location, risk_level, status, symptoms, phone) VALUES
    ('COVID-2026-0451', 'James Wilson', 'Household', '2026-03-14', 'Home - 123 Oak St', 'High', 'Quarantined', 'Cough, fever, fatigue', '555-0101'),
    ('COVID-2026-0451', 'Maria Garcia', 'Coworker', '2026-03-13', 'Office Building A', 'Medium', 'Monitoring', 'None reported', '555-0102'),
    ('TB-2026-0034', 'Robert Chen', 'Household', '2026-02-28', 'Home - 456 Pine Ave', 'High', 'Testing', 'Night sweats, weight loss', '555-0103'),
    ('MEASLES-2026-0012', 'Emily Brown', 'School Contact', '2026-03-19', 'Lincoln Elementary', 'High', 'Quarantined', 'Rash developing', '555-0104'),
    ('COVID-2026-0452', 'David Kim', 'Social Gathering', '2026-03-15', 'Community Center', 'Medium', 'Monitoring', 'Mild sore throat', '555-0105'),
    ('FLU-2026-0198', 'Sarah Johnson', 'Healthcare Worker', '2026-03-09', 'Metro Hospital ER', 'High', 'Symptomatic', 'High fever, body aches', '555-0106'),
    ('CHOLERA-2026-0008', 'Ahmed Hassan', 'Neighbor', '2026-02-19', 'Village Well Area', 'High', 'Hospitalized', 'Severe diarrhea, dehydration', '555-0107'),
    ('TB-2026-0035', 'Lisa Wang', 'Workplace', '2026-03-01', 'Factory Floor B', 'Medium', 'Testing', 'Persistent cough', '555-0108'),
    ('MEASLES-2026-0013', 'Michael Davis', 'Parent', '2026-03-20', 'Home - 789 Elm Dr', 'High', 'Monitoring', 'None - vaccinated', '555-0109'),
    ('DENGUE-2026-0089', 'Ana Santos', 'Neighbor', '2026-02-27', 'Residential Block 5', 'Medium', 'Monitoring', 'Mild headache', '555-0110'),
    ('COVID-2026-0453', 'Thomas Lee', 'Gym Partner', '2026-03-16', 'FitLife Gym', 'Low', 'Cleared', 'None reported', '555-0111'),
    ('HEPA-2026-0023', 'Jessica Moore', 'Restaurant Staff', '2026-03-04', 'Downtown Bistro', 'High', 'Testing', 'Jaundice, nausea', '555-0112'),
    ('PERTUSSIS-2026-0045', 'Daniel Martinez', 'Classmate', '2026-03-11', 'Westside High School', 'Medium', 'Monitoring', 'Mild cough', '555-0113'),
    ('LEGIONELLA-2026-0005', 'Nancy Taylor', 'Office Building', '2026-03-07', 'Tower One, Floor 12', 'High', 'Hospitalized', 'Pneumonia symptoms', '555-0114'),
    ('MPOX-2026-0011', 'Kevin Anderson', 'Close Contact', '2026-03-13', 'Private Residence', 'High', 'Monitoring', 'Developing lesions', '555-0115'),
    ('ECOLI-2026-0017', 'Rachel Green', 'Dining Companion', '2026-02-24', 'Farmhouse Restaurant', 'Medium', 'Symptomatic', 'Abdominal cramps', '555-0116')
  `);

  // Seed syndromic surveillance (16 items)
  await pool.query(`
    INSERT INTO syndromic_surveillance (syndrome, facility, region, case_count, baseline_count, alert_level, report_date, symptoms_description, age_group) VALUES
    ('Influenza-Like Illness', 'Metro General Hospital', 'Metro District A', 245, 120, 'Warning', '2026-03-22', 'Fever >100.4F, cough, myalgia', 'All Ages'),
    ('Acute Respiratory Infection', 'Northern Regional Med', 'Northern Region', 189, 95, 'Alert', '2026-03-22', 'Cough, shortness of breath, fever', 'Adults 18-64'),
    ('Gastrointestinal Syndrome', 'Eastern Community Hosp', 'Eastern Suburbs', 78, 45, 'Warning', '2026-03-21', 'Nausea, vomiting, diarrhea', 'Pediatric 0-17'),
    ('Neurological Syndrome', 'University Hospital', 'University District', 12, 8, 'Normal', '2026-03-22', 'Headache, altered mental status', 'Adults 18-64'),
    ('Rash Illness', 'Western County Clinic', 'Western County', 34, 10, 'Alert', '2026-03-20', 'Maculopapular rash with fever', 'Pediatric 0-17'),
    ('Hemorrhagic Illness', 'Central District Hosp', 'Central District', 3, 1, 'Warning', '2026-03-21', 'Unexplained bleeding, fever', 'Adults 18-64'),
    ('Febrile Illness', 'Coastal Health Center', 'Coastal Zone B', 156, 80, 'Warning', '2026-03-22', 'Fever >101F, chills, malaise', 'All Ages'),
    ('Severe Acute Respiratory', 'Metro Childrens Hosp', 'Metro District B', 67, 30, 'Alert', '2026-03-22', 'Dyspnea, hypoxia, fever', 'Pediatric 0-17'),
    ('Hepatitis-Like Syndrome', 'Southern Regional Med', 'Southern Region', 23, 12, 'Warning', '2026-03-19', 'Jaundice, dark urine, fatigue', 'Adults 18-64'),
    ('Botulism-Like Syndrome', 'Rural Health Clinic', 'Rural District C', 2, 0, 'Alert', '2026-03-18', 'Descending paralysis, diplopia', 'Elderly 65+'),
    ('Lymphadenopathy', 'Metro Area Urgent Care', 'Metro Area', 18, 10, 'Normal', '2026-03-22', 'Swollen lymph nodes, fever', 'Adults 18-64'),
    ('Sepsis-Like Syndrome', 'Northern Valley Hospital', 'Northern Valley', 28, 20, 'Normal', '2026-03-21', 'Fever, tachycardia, hypotension', 'Elderly 65+'),
    ('Asthma Exacerbation', 'Downtown Childrens Clinic', 'Downtown District', 89, 40, 'Alert', '2026-03-22', 'Wheezing, dyspnea, chest tightness', 'Pediatric 0-17'),
    ('Meningitis-Like Syndrome', 'University Hospital', 'University District', 5, 2, 'Warning', '2026-03-20', 'Neck stiffness, photophobia, fever', 'Young Adults 18-25'),
    ('Heat-Related Illness', 'Suburban ER', 'Suburban Region', 45, 15, 'Alert', '2026-03-15', 'Heat exhaustion, dehydration', 'Elderly 65+'),
    ('Carbon Monoxide Exposure', 'Metro General Hospital', 'Metro District A', 8, 3, 'Warning', '2026-03-17', 'Headache, dizziness, nausea', 'All Ages')
  `);

  // Seed water quality (16 items)
  await pool.query(`
    INSERT INTO water_quality (source_name, location, ph_level, turbidity, contaminant, contaminant_level, safe_limit, status, sample_date) VALUES
    ('Lake Reservoir A', 'Northern Treatment Plant', 7.20, 1.50, 'E. coli', 0.0000, 0.0000, 'Safe', '2026-03-20'),
    ('River Source B', 'Central Intake Station', 6.80, 4.20, 'Lead', 0.0120, 0.0150, 'Safe', '2026-03-19'),
    ('Municipal Well 7', 'Eastern District', 7.50, 0.80, 'Nitrate', 8.5000, 10.0000, 'Safe', '2026-03-22'),
    ('Spring Source C', 'Western County', 7.10, 0.30, 'Arsenic', 0.0080, 0.0100, 'Warning', '2026-03-18'),
    ('Groundwater Well 12', 'Southern Region', 6.50, 2.10, 'PFAS', 0.0060, 0.0040, 'Unsafe', '2026-03-21'),
    ('Lake Reservoir B', 'Metro Treatment Facility', 7.40, 1.20, 'Trihalomethanes', 0.0650, 0.0800, 'Safe', '2026-03-22'),
    ('River Intake D', 'Coastal Zone B', 7.80, 6.50, 'Turbidity', 6.5000, 4.0000, 'Warning', '2026-03-20'),
    ('Deep Well 3', 'Rural District C', 6.90, 0.50, 'Fluoride', 3.8000, 4.0000, 'Safe', '2026-03-17'),
    ('Municipal Well 15', 'Suburban Region', 7.30, 1.00, 'Chromium-6', 0.0085, 0.0100, 'Warning', '2026-03-19'),
    ('Surface Water E', 'Agricultural Belt', 7.00, 8.30, 'Pesticide Residue', 0.0450, 0.0300, 'Unsafe', '2026-03-16'),
    ('Reservoir C', 'Northern Valley', 7.60, 0.90, 'Chloramine', 3.5000, 4.0000, 'Safe', '2026-03-22'),
    ('Spring Source D', 'Mountain District', 6.70, 0.20, 'Radon', 250.0000, 300.0000, 'Safe', '2026-03-15'),
    ('River Source F', 'Industrial Zone', 6.30, 12.00, 'Mercury', 0.0030, 0.0020, 'Unsafe', '2026-03-21'),
    ('Municipal Well 22', 'Downtown District', 7.10, 1.80, 'Copper', 1.1000, 1.3000, 'Safe', '2026-03-20'),
    ('Groundwater Well 8', 'University District', 7.40, 0.60, 'Perchlorate', 0.0035, 0.0040, 'Safe', '2026-03-18'),
    ('Lake Source G', 'Tropical Zone A', 7.90, 3.40, 'Cyanobacteria Toxin', 0.0012, 0.0010, 'Unsafe', '2026-03-22')
  `);

  // Seed air quality (16 items)
  await pool.query(`
    INSERT INTO air_quality (station_name, location, aqi_value, pm25, pm10, ozone, co_level, category, reading_date) VALUES
    ('Metro Central Station', 'Downtown District', 85, 28.50, 45.00, 0.0650, 0.8000, 'Moderate', '2026-03-22'),
    ('Northern Valley Monitor', 'Northern Valley', 42, 12.00, 22.00, 0.0400, 0.4000, 'Good', '2026-03-22'),
    ('Industrial Zone Sensor', 'Industrial Zone', 156, 65.00, 98.00, 0.0850, 1.5000, 'Unhealthy', '2026-03-22'),
    ('Coastal Breeze Station', 'Coastal Zone B', 35, 8.50, 18.00, 0.0350, 0.3000, 'Good', '2026-03-22'),
    ('Highway 101 Monitor', 'Metro District A', 112, 42.00, 68.00, 0.0750, 2.1000, 'Unhealthy for Sensitive', '2026-03-22'),
    ('Suburban Park Station', 'Suburban Region', 55, 16.00, 30.00, 0.0500, 0.5000, 'Moderate', '2026-03-22'),
    ('Agricultural Monitor', 'Agricultural Belt', 78, 24.00, 52.00, 0.0600, 0.6000, 'Moderate', '2026-03-22'),
    ('School Zone Sensor', 'University District', 48, 14.00, 25.00, 0.0420, 0.4500, 'Good', '2026-03-22'),
    ('Mountain Station', 'Mountain District', 22, 5.00, 10.00, 0.0300, 0.2000, 'Good', '2026-03-22'),
    ('Fire Zone Monitor', 'Western County', 205, 120.00, 180.00, 0.0950, 3.2000, 'Very Unhealthy', '2026-03-21'),
    ('Airport Monitor', 'Metro District B', 95, 32.00, 55.00, 0.0700, 1.2000, 'Moderate', '2026-03-22'),
    ('Harbor Station', 'Southern Region', 68, 20.00, 38.00, 0.0550, 0.9000, 'Moderate', '2026-03-22'),
    ('Rural Station', 'Rural District C', 30, 7.00, 15.00, 0.0320, 0.2500, 'Good', '2026-03-22'),
    ('Hospital Zone Monitor', 'Central District', 72, 22.00, 40.00, 0.0580, 0.7000, 'Moderate', '2026-03-22'),
    ('Refinery Fence Line', 'Industrial Zone', 178, 78.00, 125.00, 0.0900, 2.8000, 'Unhealthy', '2026-03-22'),
    ('Residential East', 'Eastern Suburbs', 52, 15.00, 28.00, 0.0480, 0.5500, 'Moderate', '2026-03-22')
  `);

  // Seed hospital capacity (16 items)
  await pool.query(`
    INSERT INTO hospital_capacity (hospital_name, region, total_beds, occupied_beds, icu_total, icu_occupied, ventilators_total, ventilators_in_use, status, report_date) VALUES
    ('Metro General Hospital', 'Metro District A', 800, 720, 80, 68, 50, 38, 'Near Capacity', '2026-03-22'),
    ('Northern Regional Medical', 'Northern Region', 500, 380, 50, 35, 30, 18, 'Normal', '2026-03-22'),
    ('Western County Hospital', 'Western County', 350, 290, 35, 28, 20, 14, 'Warning', '2026-03-22'),
    ('Coastal Medical Center', 'Coastal Zone B', 420, 340, 40, 30, 25, 16, 'Normal', '2026-03-22'),
    ('Central District Hospital', 'Central District', 600, 540, 60, 52, 40, 32, 'Near Capacity', '2026-03-22'),
    ('Eastern Community Hospital', 'Eastern Suburbs', 280, 195, 25, 15, 15, 8, 'Normal', '2026-03-22'),
    ('Southern Regional Med Center', 'Southern Region', 550, 480, 55, 45, 35, 28, 'Warning', '2026-03-22'),
    ('University Hospital', 'University District', 750, 600, 75, 55, 45, 30, 'Normal', '2026-03-22'),
    ('Metro Childrens Hospital', 'Metro District B', 300, 265, 30, 26, 20, 16, 'Near Capacity', '2026-03-22'),
    ('Rural Health Center', 'Rural District C', 120, 85, 10, 7, 5, 3, 'Normal', '2026-03-22'),
    ('Mountain District Hospital', 'Mountain District', 180, 130, 15, 10, 8, 5, 'Normal', '2026-03-22'),
    ('Northern Valley Hospital', 'Northern Valley', 400, 350, 40, 34, 25, 20, 'Warning', '2026-03-22'),
    ('Downtown Trauma Center', 'Downtown District', 450, 420, 50, 47, 35, 30, 'Critical', '2026-03-22'),
    ('Suburban Medical Center', 'Suburban Region', 320, 240, 30, 20, 18, 10, 'Normal', '2026-03-22'),
    ('Tropical Disease Hospital', 'Tropical Zone A', 250, 210, 25, 20, 15, 12, 'Warning', '2026-03-22'),
    ('Agricultural Belt Clinic', 'Agricultural Belt', 150, 100, 12, 8, 6, 4, 'Normal', '2026-03-22')
  `);

  // Seed mortality stats (16 items)
  await pool.query(`
    INSERT INTO mortality_stats (region, cause_of_death, age_group, gender, count, population, rate_per_100k, report_date, trend) VALUES
    ('Metro District A', 'Heart Disease', '65+', 'Male', 245, 180000, 136.11, '2026-03-01', 'Stable'),
    ('Northern Region', 'Cancer', '45-64', 'Female', 189, 250000, 75.60, '2026-03-01', 'Declining'),
    ('Western County', 'COVID-19', '65+', 'Both', 34, 95000, 35.79, '2026-03-01', 'Declining'),
    ('Coastal Zone B', 'Dengue Complications', '18-44', 'Both', 5, 150000, 3.33, '2026-03-01', 'Increasing'),
    ('Central District', 'Tuberculosis', '45-64', 'Male', 12, 200000, 6.00, '2026-03-01', 'Stable'),
    ('Eastern Suburbs', 'Stroke', '65+', 'Female', 78, 120000, 65.00, '2026-03-01', 'Stable'),
    ('Southern Region', 'Diabetes', '45-64', 'Both', 156, 300000, 52.00, '2026-03-01', 'Increasing'),
    ('University District', 'Suicide', '18-44', 'Male', 23, 180000, 12.78, '2026-03-01', 'Increasing'),
    ('Metro District B', 'Chronic Respiratory', '65+', 'Both', 167, 220000, 75.91, '2026-03-01', 'Stable'),
    ('Rural District C', 'Cholera', '0-17', 'Both', 8, 45000, 17.78, '2026-03-01', 'Increasing'),
    ('Mountain District', 'Accidental Injury', '18-44', 'Male', 34, 80000, 42.50, '2026-03-01', 'Stable'),
    ('Northern Valley', 'Pneumonia', '65+', 'Both', 89, 140000, 63.57, '2026-03-01', 'Increasing'),
    ('Downtown District', 'Drug Overdose', '18-44', 'Both', 67, 160000, 41.88, '2026-03-01', 'Increasing'),
    ('Suburban Region', 'Alzheimers', '65+', 'Female', 112, 190000, 58.95, '2026-03-01', 'Increasing'),
    ('Tropical Zone A', 'Malaria', '0-17', 'Both', 15, 60000, 25.00, '2026-03-01', 'Declining'),
    ('Agricultural Belt', 'Pesticide Poisoning', '18-44', 'Male', 9, 70000, 12.86, '2026-03-01', 'Stable')
  `);

  // Seed disease reports (16 items)
  await pool.query(`
    INSERT INTO disease_reports (disease_name, icd_code, reporting_facility, patient_age, patient_gender, diagnosis_date, report_date, severity, lab_confirmed, notes) VALUES
    ('COVID-19', 'U07.1', 'Metro General Hospital', 67, 'Male', '2026-03-20', '2026-03-21', 'Severe', true, 'Hospitalized with bilateral pneumonia, oxygen dependent'),
    ('Influenza A', 'J09.X2', 'Northern Regional Med', 45, 'Female', '2026-03-19', '2026-03-20', 'Moderate', true, 'Rapid flu test positive, Tamiflu prescribed'),
    ('Measles', 'B05.9', 'Western County Clinic', 8, 'Male', '2026-03-18', '2026-03-19', 'Moderate', true, 'Unvaccinated child with classic presentation'),
    ('Dengue Fever', 'A90', 'Coastal Medical Center', 32, 'Female', '2026-03-17', '2026-03-18', 'Severe', true, 'Dengue hemorrhagic fever, platelet count critically low'),
    ('Tuberculosis', 'A15.0', 'Central District Hospital', 55, 'Male', '2026-03-15', '2026-03-16', 'Severe', true, 'Sputum smear positive, MDR pattern'),
    ('Hepatitis A', 'B15.9', 'Southern Regional Med', 28, 'Female', '2026-03-14', '2026-03-15', 'Moderate', true, 'Acute viral hepatitis, elevated liver enzymes'),
    ('Pertussis', 'A37.0', 'Metro Childrens Hospital', 4, 'Female', '2026-03-16', '2026-03-17', 'Moderate', true, 'Paroxysmal cough, PCR confirmed'),
    ('Salmonellosis', 'A02.0', 'Eastern Community Hosp', 38, 'Male', '2026-03-13', '2026-03-14', 'Mild', true, 'Stool culture positive, outpatient management'),
    ('Legionnaires', 'A48.1', 'Downtown Trauma Center', 71, 'Male', '2026-03-12', '2026-03-13', 'Critical', true, 'Severe pneumonia, ICU admission'),
    ('Cholera', 'A00.1', 'Rural Health Center', 12, 'Female', '2026-03-11', '2026-03-12', 'Severe', true, 'Severe dehydration, IV fluid resuscitation'),
    ('Mpox', 'B04', 'University Hospital', 29, 'Male', '2026-03-10', '2026-03-11', 'Moderate', true, 'Characteristic lesions, PCR confirmed'),
    ('E. coli O157', 'A04.3', 'Northern Valley Hospital', 6, 'Female', '2026-03-09', '2026-03-10', 'Severe', true, 'HUS developing, nephrology consult'),
    ('RSV', 'J12.1', 'Metro Childrens Hospital', 2, 'Male', '2026-03-08', '2026-03-09', 'Severe', true, 'Bronchiolitis requiring supplemental oxygen'),
    ('Norovirus', 'A08.1', 'Suburban Medical Center', 42, 'Female', '2026-03-07', '2026-03-08', 'Mild', false, 'Clinical diagnosis, linked to catering event'),
    ('Zika Virus', 'A92.5', 'Tropical Disease Hospital', 25, 'Female', '2026-03-06', '2026-03-07', 'Moderate', true, 'Pregnant patient, serial ultrasounds ordered'),
    ('Hand Foot Mouth', 'B08.4', 'Suburban Medical Center', 3, 'Male', '2026-03-05', '2026-03-06', 'Mild', false, 'Clinical diagnosis, daycare exposure')
  `);

  // Seed AMR (16 items)
  await pool.query(`
    INSERT INTO antimicrobial_resistance (organism, antibiotic, resistance_pattern, facility, specimen_type, mic_value, interpretation, test_date, patient_age) VALUES
    ('MRSA', 'Oxacillin', 'Resistant', 'Metro General Hospital', 'Blood Culture', '>=4', 'R', '2026-03-20', 68),
    ('E. coli ESBL', 'Ceftriaxone', 'Resistant', 'Northern Regional Med', 'Urine', '>=64', 'R', '2026-03-19', 72),
    ('Klebsiella pneumoniae CRE', 'Meropenem', 'Resistant', 'Central District Hospital', 'Sputum', '>=8', 'R', '2026-03-18', 55),
    ('Pseudomonas aeruginosa', 'Ciprofloxacin', 'Intermediate', 'University Hospital', 'Wound', '2', 'I', '2026-03-17', 48),
    ('VRE (Enterococcus faecium)', 'Vancomycin', 'Resistant', 'Downtown Trauma Center', 'Blood Culture', '>=32', 'R', '2026-03-16', 78),
    ('Acinetobacter baumannii', 'Imipenem', 'Resistant', 'Metro General Hospital', 'BAL', '>=16', 'R', '2026-03-15', 62),
    ('Streptococcus pneumoniae', 'Penicillin', 'Intermediate', 'Metro Childrens Hospital', 'CSF', '0.12', 'I', '2026-03-14', 5),
    ('Neisseria gonorrhoeae', 'Azithromycin', 'Resistant', 'University Hospital', 'Genital Swab', '>=2', 'R', '2026-03-13', 28),
    ('Mycobacterium tuberculosis', 'Isoniazid', 'Resistant', 'Central District Hospital', 'Sputum', 'N/A', 'R', '2026-03-12', 45),
    ('Salmonella typhi', 'Fluoroquinolone', 'Resistant', 'Eastern Community Hosp', 'Blood Culture', '>=4', 'R', '2026-03-11', 34),
    ('Staphylococcus epidermidis', 'Methicillin', 'Resistant', 'Northern Valley Hospital', 'Blood Culture', '>=4', 'R', '2026-03-10', 80),
    ('Clostridioides difficile', 'Metronidazole', 'Intermediate', 'Southern Regional Med', 'Stool', '16', 'I', '2026-03-09', 75),
    ('Candida auris', 'Fluconazole', 'Resistant', 'Downtown Trauma Center', 'Blood Culture', '>=64', 'R', '2026-03-08', 65),
    ('E. coli', 'Trimethoprim-Sulfa', 'Resistant', 'Suburban Medical Center', 'Urine', '>=320', 'R', '2026-03-07', 42),
    ('Helicobacter pylori', 'Clarithromycin', 'Resistant', 'University Hospital', 'Gastric Biopsy', '>=1', 'R', '2026-03-06', 50),
    ('Shigella sonnei', 'Ampicillin', 'Resistant', 'Rural Health Center', 'Stool', '>=32', 'R', '2026-03-05', 8)
  `);

  // Seed vector diseases (16 items)
  await pool.query(`
    INSERT INTO vector_diseases (disease_name, vector_type, location, cases_count, season, habitat_risk, control_measures, report_date, status) VALUES
    ('Dengue Fever', 'Aedes aegypti', 'Coastal Zone B', 567, 'Rainy Season', 'High', 'Fogging, larvicide, community cleanup', '2026-03-20', 'Active'),
    ('Malaria (P. falciparum)', 'Anopheles mosquito', 'Tropical Zone A', 234, 'Year-round', 'High', 'ITN distribution, indoor residual spraying', '2026-03-19', 'Active'),
    ('Zika Virus', 'Aedes mosquito', 'Coastal Zone B', 45, 'Rainy Season', 'Medium', 'Vector surveillance, travel advisories', '2026-03-18', 'Monitoring'),
    ('Lyme Disease', 'Ixodes tick', 'Northern Valley', 89, 'Spring/Summer', 'High', 'Tick awareness campaigns, habitat management', '2026-03-17', 'Active'),
    ('West Nile Virus', 'Culex mosquito', 'Agricultural Belt', 34, 'Summer', 'Medium', 'Mosquito trapping, larvicide in standing water', '2026-03-16', 'Monitoring'),
    ('Chikungunya', 'Aedes albopictus', 'Tropical Zone A', 123, 'Rainy Season', 'High', 'Source reduction, community education', '2026-03-15', 'Active'),
    ('Chagas Disease', 'Triatomine bug', 'Rural District C', 12, 'Year-round', 'Medium', 'Housing improvement, insecticide spraying', '2026-03-14', 'Monitoring'),
    ('Leishmaniasis', 'Sandfly', 'Mountain District', 28, 'Summer', 'Medium', 'Sandfly nets, environmental management', '2026-03-13', 'Active'),
    ('Yellow Fever', 'Aedes/Haemagogus', 'Tropical Zone A', 8, 'Rainy Season', 'High', 'Emergency vaccination, vector control', '2026-03-12', 'Active'),
    ('Rocky Mountain Spotted Fever', 'Dermacentor tick', 'Mountain District', 15, 'Spring/Summer', 'Medium', 'Tick removal education, yard treatment', '2026-03-11', 'Monitoring'),
    ('Plague', 'Flea (Xenopsylla)', 'Rural District C', 3, 'Summer', 'Low', 'Rodent control, flea treatment', '2026-03-10', 'Contained'),
    ('Japanese Encephalitis', 'Culex tritaeniorhynchus', 'Agricultural Belt', 18, 'Monsoon', 'High', 'Vaccination, pig pen relocation', '2026-03-09', 'Active'),
    ('Scrub Typhus', 'Chigger mite', 'Rural District C', 22, 'Rainy Season', 'Medium', 'Vegetation clearing, personal protection', '2026-03-08', 'Active'),
    ('Babesiosis', 'Ixodes tick', 'Eastern Suburbs', 7, 'Spring/Summer', 'Low', 'Tick prevention education', '2026-03-07', 'Monitoring'),
    ('Rift Valley Fever', 'Aedes/Culex mosquito', 'Agricultural Belt', 5, 'After flooding', 'High', 'Animal vaccination, mosquito control', '2026-03-06', 'Monitoring'),
    ('Trypanosomiasis', 'Tsetse fly', 'Tropical Zone A', 2, 'Year-round', 'Low', 'Tsetse traps, bush clearing', '2026-03-05', 'Contained')
  `);

  // Seed health equity (16 items)
  await pool.query(`
    INSERT INTO health_equity (indicator, region, demographic_group, value, benchmark, disparity_ratio, data_source, report_date, notes) VALUES
    ('Life Expectancy', 'Metro District A', 'Black/African American', 72.30, 78.80, 0.92, 'CDC WONDER', '2026-03-01', '6.5 year gap compared to white population'),
    ('Infant Mortality Rate', 'Southern Region', 'Hispanic/Latino', 6.80, 5.40, 1.26, 'State Vital Records', '2026-03-01', 'Higher than state average, improving trend'),
    ('Diabetes Prevalence', 'Rural District C', 'Native American', 18.50, 10.20, 1.81, 'BRFSS Survey', '2026-03-01', 'Limited access to endocrinology specialists'),
    ('Insurance Coverage', 'Agricultural Belt', 'Undocumented Immigrants', 23.00, 91.50, 0.25, 'ACS Estimates', '2026-03-01', 'Significant gap in healthcare access'),
    ('COVID-19 Vaccination', 'Metro District B', 'Black/African American', 52.00, 72.00, 0.72, 'Immunization Registry', '2026-03-01', 'Trust gap and access barriers identified'),
    ('Mental Health Access', 'University District', 'LGBTQ+ Youth', 34.00, 55.00, 0.62, 'Youth Risk Survey', '2026-03-01', 'Higher need, lower access to culturally competent care'),
    ('Obesity Rate', 'Eastern Suburbs', 'Low-Income Families', 42.00, 30.50, 1.38, 'NHANES Data', '2026-03-01', 'Food desert correlation identified'),
    ('Prenatal Care Utilization', 'Northern Region', 'Rural Women', 64.00, 83.00, 0.77, 'Birth Certificate Data', '2026-03-01', 'Transportation and provider shortage barriers'),
    ('Cancer Screening Rate', 'Central District', 'Asian American', 58.00, 72.00, 0.81, 'Cancer Registry', '2026-03-01', 'Language barriers and cultural factors'),
    ('Childhood Immunization', 'Western County', 'Religious Exemption Groups', 68.00, 95.00, 0.72, 'School Entry Records', '2026-03-01', 'Below herd immunity threshold'),
    ('Substance Abuse Treatment', 'Downtown District', 'Homeless Population', 12.00, 45.00, 0.27, 'SAMHSA TEDS', '2026-03-01', 'Critical gap in accessible treatment services'),
    ('Maternal Mortality', 'Statewide', 'Black Women', 55.30, 23.80, 2.32, 'Maternal Mortality Review', '2026-03-01', 'Highest disparity ratio in dataset'),
    ('Lead Exposure', 'Metro District A', 'Children in Older Housing', 8.50, 2.50, 3.40, 'Lead Screening Program', '2026-03-01', 'Housing stock built before 1978'),
    ('Tuberculosis Incidence', 'Central District', 'Foreign-Born Population', 15.20, 2.80, 5.43, 'TB Surveillance', '2026-03-01', 'Screening and treatment access gaps'),
    ('Heart Disease Mortality', 'Suburban Region', 'South Asian', 185.00, 160.00, 1.16, 'Death Certificate Data', '2026-03-01', 'Dietary and genetic risk factors'),
    ('Dental Care Access', 'Rural District C', 'Medicaid Recipients', 28.00, 65.00, 0.43, 'Medicaid Claims', '2026-03-01', 'Only 2 dentists accepting Medicaid in county')
  `);

  console.log('Database seeded successfully!');
  process.exit(0);
}

seed().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
