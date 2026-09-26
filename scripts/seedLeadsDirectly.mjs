import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBZE0Zwwvyc963ddo_I8LTc8emlhayZ_NY",
  authDomain: "crm-webapp-d32bc.firebaseapp.com",
  projectId: "crm-webapp-d32bc",
  storageBucket: "crm-webapp-d32bc.firebasestorage.app",
  messagingSenderId: "940267952934",
  appId: "1:940267952934:web:18ba7928b92968bcdcbfe7"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const leads = [
  {
    id: 'LEAD-101',
    customer: 'Rajesh Sharma',
    phone: '+91 98450 12345',
    email: 'rajesh.sharma@gmail.com',
    location: 'Banjara Hills, Hyderabad',
    dealer: 'Hussain',
    assignedEmployee: 'Jaswanth',
    stage: 'Installation',
    priority: 'High',
    leadType: 'project',
    archived: false,
    createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
    followUp: {
      date: new Date().toISOString().split('T')[0],
      time: '11:00 AM',
      type: 'Payment',
      status: 'Completed'
    },
    dealerSpecifications: {
      fullName: 'Rajesh Sharma',
      phone: '+91 98450 12345',
      systemCapacityKw: '5 kW',
      panelWp: '550 Wp',
      phase: '3 Phase',
      buildingFloors: '2 Floors',
      structureHeightAndType: 'Company Structure'
    },
    payments: {
      totalProjectCost: 250000,
      totalAgreedAmount: 25000,
      customerPayments: [
        {
          id: 'CP_101_1',
          leadId: 'LEAD-101',
          customerName: 'Rajesh Sharma',
          amount: 50000,
          paymentType: 'Booking / Advance',
          paymentMode: 'UPI',
          status: 'Verified',
          paidAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
          referenceNumber: 'UPI9281048201',
          recordedBy: 'Jaswanth',
          recordedByRole: 'Employee',
          verifiedBy: 'Admin',
          verifiedAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
          notes: 'GPay booking advance collected'
        },
        {
          id: 'CP_101_2',
          leadId: 'LEAD-101',
          customerName: 'Rajesh Sharma',
          amount: 100000,
          paymentType: 'First Milestone',
          paymentMode: 'Bank Transfer / NEFT',
          status: 'Verified',
          paidAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
          referenceNumber: 'HDFC982103810',
          recordedBy: 'Admin',
          recordedByRole: 'Admin',
          verifiedBy: 'Admin',
          verifiedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
          notes: 'Material dispatch 1st milestone received'
        },
        {
          id: 'CP_101_3',
          leadId: 'LEAD-101',
          customerName: 'Rajesh Sharma',
          amount: 100000,
          paymentType: 'Final Payment',
          paymentMode: 'Net Banking',
          status: 'Verified',
          paidAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          referenceNumber: 'ICIC772910482',
          recordedBy: 'Admin',
          recordedByRole: 'Admin',
          verifiedBy: 'Admin',
          verifiedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          notes: 'Final balance payment cleared'
        }
      ],
      preInstallation: {
        id: 'PRE_LEAD-101',
        type: 'Pre-Installation',
        amount: 15000,
        status: 'Received',
        utrNumber: 'CMS9821094',
        settledAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        settledBy: 'Admin',
        receivedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        receivedBy: 'Hussain',
        adminNotes: 'Pre-installation payout released to dealer bank account'
      },
      postInstallation: {
        id: 'POST_LEAD-101',
        type: 'Post-Installation',
        amount: 10000,
        status: 'Received',
        utrNumber: 'CMS9912048',
        settledAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        settledBy: 'Admin',
        receivedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        receivedBy: 'Hussain',
        adminNotes: 'Final installation milestone commission settled'
      }
    }
  },
  {
    id: 'LEAD-102',
    customer: 'Priya Reddy',
    phone: '+91 97011 23456',
    email: 'priya.reddy@gmail.com',
    location: 'Gachibowli, Hyderabad',
    dealer: 'Hussain',
    assignedEmployee: 'Jaswanth',
    stage: 'Material',
    priority: 'Medium',
    leadType: 'project',
    archived: false,
    createdAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
    followUp: {
      date: new Date().toISOString().split('T')[0],
      time: '03:30 PM',
      type: 'Visit',
      status: 'Due Today'
    },
    dealerSpecifications: {
      fullName: 'Priya Reddy',
      phone: '+91 97011 23456',
      systemCapacityKw: '3 kW',
      panelWp: '540 Wp',
      phase: '1 Phase',
      buildingFloors: '1 Floor',
      structureHeightAndType: 'Company Structure'
    },
    payments: {
      totalProjectCost: 180000,
      totalAgreedAmount: 18000,
      customerPayments: [
        {
          id: 'CP_102_1',
          leadId: 'LEAD-102',
          customerName: 'Priya Reddy',
          amount: 30000,
          paymentType: 'Booking / Advance',
          paymentMode: 'UPI',
          status: 'Verified',
          paidAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
          referenceNumber: 'PAYTM88291048',
          recordedBy: 'Jaswanth',
          recordedByRole: 'Employee',
          verifiedBy: 'Admin',
          verifiedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
          notes: 'Paytm initial booking advance'
        },
        {
          id: 'CP_102_2',
          leadId: 'LEAD-102',
          customerName: 'Priya Reddy',
          amount: 60000,
          paymentType: 'First Milestone',
          paymentMode: 'Bank Transfer / NEFT',
          status: 'Verified',
          paidAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          referenceNumber: 'SBIN00291048',
          recordedBy: 'Admin',
          recordedByRole: 'Admin',
          verifiedBy: 'Admin',
          verifiedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          notes: 'Material dispatch milestone'
        }
      ],
      preInstallation: {
        id: 'PRE_LEAD-102',
        type: 'Pre-Installation',
        amount: 10000,
        status: 'Settled',
        utrNumber: 'CMS7729104',
        settledAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        settledBy: 'Admin',
        adminNotes: 'Pre-installation commission transferred'
      },
      postInstallation: {
        id: 'POST_LEAD-102',
        type: 'Post-Installation',
        amount: 8000,
        status: 'Pending Settlement'
      }
    }
  },
  {
    id: 'LEAD-103',
    customer: 'Venkat Rao',
    phone: '+91 99887 76655',
    email: 'venkat.rao@gmail.com',
    location: 'Jubilee Hills, Hyderabad',
    dealer: 'Hussain',
    assignedEmployee: 'Jaswanth',
    stage: 'Lead',
    priority: 'High',
    leadType: 'project',
    archived: false,
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
    followUp: {
      date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      time: '10:00 AM',
      type: 'Call',
      status: 'Upcoming'
    },
    dealerSpecifications: {
      fullName: 'Venkat Rao',
      phone: '+91 99887 76655',
      systemCapacityKw: '10 kW',
      panelWp: '610 Wp',
      phase: '3 Phase',
      buildingFloors: '3 Floors',
      structureHeightAndType: 'Custom Welding Structure'
    },
    payments: {
      totalProjectCost: 420000,
      totalAgreedAmount: 40000,
      customerPayments: [],
      preInstallation: {
        id: 'PRE_LEAD-103',
        type: 'Pre-Installation',
        amount: 20000,
        status: 'Pending Settlement'
      },
      postInstallation: {
        id: 'POST_LEAD-103',
        type: 'Post-Installation',
        amount: 20000,
        status: 'Pending Settlement'
      }
    }
  },
  {
    id: 'LEAD-104',
    customer: 'Ananya Verma',
    phone: '+91 91234 56789',
    email: 'ananya.verma@gmail.com',
    location: 'Madhapur, Hyderabad',
    dealer: 'Hussain',
    assignedEmployee: 'Jaswanth',
    stage: 'Completed',
    priority: 'Medium',
    leadType: 'project',
    archived: false,
    createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
    followUp: {
      date: new Date().toISOString().split('T')[0],
      time: '04:00 PM',
      type: 'Document',
      status: 'Completed'
    },
    dealerSpecifications: {
      fullName: 'Ananya Verma',
      phone: '+91 91234 56789',
      systemCapacityKw: '7 kW',
      panelWp: '550 Wp',
      phase: '3 Phase',
      buildingFloors: '2 Floors',
      structureHeightAndType: 'Company Structure'
    },
    payments: {
      totalProjectCost: 320000,
      totalAgreedAmount: 32000,
      customerPayments: [
        {
          id: 'CP_104_1',
          leadId: 'LEAD-104',
          customerName: 'Ananya Verma',
          amount: 60000,
          paymentType: 'Booking / Advance',
          paymentMode: 'UPI',
          status: 'Verified',
          paidAt: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString(),
          referenceNumber: 'UPI77291048',
          recordedBy: 'Admin',
          recordedByRole: 'Admin'
        },
        {
          id: 'CP_104_2',
          leadId: 'LEAD-104',
          customerName: 'Ananya Verma',
          amount: 160000,
          paymentType: 'Bank Loan Disbursal',
          paymentMode: 'Bank Loan',
          status: 'Verified',
          paidAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
          referenceNumber: 'SBI_LOAN_991',
          recordedBy: 'Admin',
          recordedByRole: 'Admin'
        },
        {
          id: 'CP_104_3',
          leadId: 'LEAD-104',
          customerName: 'Ananya Verma',
          amount: 100000,
          paymentType: 'Final Payment',
          paymentMode: 'Net Banking',
          status: 'Verified',
          paidAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          referenceNumber: 'HDFC119284',
          recordedBy: 'Admin',
          recordedByRole: 'Admin'
        }
      ],
      preInstallation: {
        id: 'PRE_LEAD-104',
        type: 'Pre-Installation',
        amount: 16000,
        status: 'Received',
        utrNumber: 'CMS5519284',
        settledAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(),
        receivedAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString()
      },
      postInstallation: {
        id: 'POST_LEAD-104',
        type: 'Post-Installation',
        amount: 16000,
        status: 'Settled',
        utrNumber: 'CMS6629104',
        settledAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
      }
    }
  }
];

async function run() {
  console.log("Authenticating Admin User...");
  await signInWithEmailAndPassword(auth, 'admin@mirrorsolar.in', 'Password123!');
  console.log("Authenticated! Seeding sample leads to Firebase Firestore...");
  for (const lead of leads) {
    await setDoc(doc(db, 'leads', lead.id), lead, { merge: true });
    console.log(`✓ Seeded lead: ${lead.id} (${lead.customer})`);
  }
  console.log("All sample leads seeded into Firestore successfully!");
  process.exit(0);
}

run().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
