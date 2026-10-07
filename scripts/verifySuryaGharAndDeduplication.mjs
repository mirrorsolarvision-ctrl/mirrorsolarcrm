import { isLeadAssignedToEmployee } from '../src/utils/employeeCalculations.js';

// Let's test employeeCalculations logic
const mockLeadFromDealer = {
  id: "LEAD-DEALER-01",
  customer: "Koteswara Rao",
  phone: "9876543210",
  email: "koteswar@example.com",
  location: "Vijayawada",
  dealer: "Hussain",
  dealerId: "ck9OPLG03RZeJhYh60npKeMEaFz2",
  assignedEmployee: "",
  assignedEmployeeId: "",
  createdBy: "ck9OPLG03RZeJhYh60npKeMEaFz2",
  createdByName: "Hussain",
  stage: "Lead",
  priority: "High",
  archived: false
};

const mockLeadFromMarketer = {
  id: "LEAD-SIVA-01",
  customer: "Venkat Raman",
  phone: "9123456780",
  email: "venkat@example.com",
  location: "Eluru",
  dealer: "Direct (Company)",
  dealerId: "",
  assignedEmployee: "Sunkara Siva",
  assignedEmployeeId: "DHIl07h9rJPBlfzc7Cg8hrfVaWj2",
  createdBy: "DHIl07h9rJPBlfzc7Cg8hrfVaWj2",
  createdByName: "Sunkara Siva",
  stage: "Lead",
  priority: "High",
  archived: false
};

const userKumari = {
  id: "bywen9RvVcNAPF3HaSRDPnExcoL2",
  name: "Kumari",
  email: "kumari@mirrorsolar.in",
  role: "Employee",
  employeeCategory: "PM Surya Ghar Work Incharge"
};

const userSiva = {
  id: "DHIl07h9rJPBlfzc7Cg8hrfVaWj2",
  name: "Sunkara Siva",
  email: "msv-siva-001@mirrorsolar.in",
  role: "Employee",
  employeeCategory: "Marketer"
};

const userAdmin = {
  id: "H7ZkfLWPC8g5iZzILrsUU7Lp8Jq2",
  name: "Admin User",
  email: "admin@mirrorsolar.in",
  role: "Admin"
};

console.log("--- Testing Lead Visibility ---");
console.log("Kumari sees Dealer lead:", isLeadAssignedToEmployee(userKumari, mockLeadFromDealer));
console.log("Kumari sees Marketer lead:", isLeadAssignedToEmployee(userKumari, mockLeadFromMarketer));
console.log("Admin sees Dealer lead:", isLeadAssignedToEmployee(userAdmin, mockLeadFromDealer));
console.log("Admin sees Marketer lead:", isLeadAssignedToEmployee(userAdmin, mockLeadFromMarketer));
console.log("Siva sees Marketer lead:", isLeadAssignedToEmployee(userSiva, mockLeadFromMarketer));
console.log("Siva sees Dealer lead (should be false for strict privacy):", isLeadAssignedToEmployee(userSiva, mockLeadFromDealer));
