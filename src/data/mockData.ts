import { Transaction, CategorySummary, SubscriptionItem } from '../types/finance';

export const INITIAL_TRANSACTIONS: Transaction[] = [
  // 23 Sep 2026 (Spent ฿710 · 3 transactions)
  {
    id: 'tx-23-01',
    title: 'ร้านอาหารข้าวต้มปลา XYZ',
    category: 'Food & Dining',
    amount: -450,
    date: '2026-09-23',
    time: '12:42 PM',
    verifiedFromSlip: true,
    paymentMethod: 'KBank Transfer',
    note: 'มื้อเที่ยงกับทีม ข้าวต้มปลากะพงพิเศษ',
    slip: {
      bankName: 'KBank',
      bankCode: 'KBANK',
      slipType: 'K PLUS · e-Slip',
      status: 'โอนเงินสำเร็จ',
      amount: 450.0,
      senderName: 'นาย ธัญญ์พิสิษฐ์ โ.',
      senderAccount: 'xxx-x-xx189-4',
      recipientName: 'ร้านอาหารข้าวต้มปลา XYZ',
      recipientPromptPay: 'xxx-xxx-8819',
      refNo: 'KB-20260923-882194',
      dateTimeStr: '23/09/69 12:42',
      rawLineMessageId: 'line_msg_8821948831'
    }
  },
  {
    id: 'tx-23-02',
    title: 'Grab Transport',
    category: 'Transport',
    amount: -120,
    date: '2026-09-23',
    time: '10:15 AM',
    verifiedFromSlip: true,
    paymentMethod: 'GrabPay / KBank',
    note: 'เดินทางไปประชุมลูกค้าสุขุมวิท',
    slip: {
      bankName: 'KBank',
      bankCode: 'KBANK',
      slipType: 'K PLUS · e-Slip',
      status: 'โอนเงินสำเร็จ',
      amount: 120.0,
      senderName: 'นาย ธัญญ์พิสิษฐ์ โ.',
      recipientName: 'Grab Thailand (Transport)',
      recipientPromptPay: '0105557088192',
      refNo: 'KB-20260923-441029',
      dateTimeStr: '23/09/69 10:15'
    }
  },
  {
    id: 'tx-23-03',
    title: 'Roots Coffee',
    category: 'Food & Dining',
    amount: -140,
    date: '2026-09-23',
    time: '08:30 AM',
    verifiedFromSlip: true,
    paymentMethod: 'PromptPay',
    note: 'Iced Americano Single Origin',
    slip: {
      bankName: 'KBank',
      bankCode: 'KBANK',
      slipType: 'K PLUS · e-Slip',
      status: 'โอนเงินสำเร็จ',
      amount: 140.0,
      senderName: 'นาย ธัญญ์พิสิษฐ์ โ.',
      recipientName: 'Roots Coffee BKK',
      recipientPromptPay: 'xxx-xxx-4122',
      refNo: 'KB-20260923-110294',
      dateTimeStr: '23/09/69 08:30'
    }
  },

  // 22 Sep 2026 (Net +฿4,031)
  {
    id: 'tx-22-01',
    title: 'Freelance Design Work',
    category: 'Income',
    amount: 5000,
    date: '2026-09-22',
    time: '18:30 PM',
    verifiedFromSlip: true,
    paymentMethod: 'SCB Transfer In',
    note: 'ค่าออกแบบ Brand Identity เฟส 1',
    slip: {
      bankName: 'SCB',
      bankCode: 'SCB',
      slipType: 'SCB EASY · e-Slip',
      status: 'เงินเข้าสำเร็จ',
      amount: 5000.0,
      senderName: 'บจก. สตูดิโอ ครีเอทีฟ ดีไซน์',
      recipientName: 'นาย ธัญญ์พิสิษฐ์ โ.',
      recipientPromptPay: 'xxx-xxx-7182',
      refNo: 'SCB-20260922-991201',
      dateTimeStr: '22/09/69 18:30'
    }
  },
  {
    id: 'tx-22-02',
    title: 'Uniqlo CentralWorld',
    category: 'Shopping',
    amount: -890,
    date: '2026-09-22',
    time: '15:15 PM',
    verifiedFromSlip: true,
    paymentMethod: 'Credit Card',
    note: 'เสื้อเชิ้ต Airism Oversized'
  },
  {
    id: 'tx-22-03',
    title: '7-Eleven Samyan',
    category: 'Food & Dining',
    amount: -79,
    date: '2026-09-22',
    time: '07:45 AM',
    verifiedFromSlip: true,
    paymentMethod: 'TrueMoney Wallet',
    note: 'แซนวิชแฮมชีส + นมถั่วเหลือง'
  },

  // 21 Sep 2026
  {
    id: 'tx-21-01',
    title: 'Roots Coffee BKK',
    category: 'Food & Dining',
    amount: -140,
    date: '2026-09-21',
    time: '09:15 AM',
    verifiedFromSlip: false,
    paymentMethod: 'PromptPay'
  },
  {
    id: 'tx-21-02',
    title: 'BTS Skytrain',
    category: 'Transport',
    amount: -62,
    date: '2026-09-21',
    time: '08:30 AM',
    verifiedFromSlip: false,
    paymentMethod: 'Rabbit Card'
  },
  {
    id: 'tx-21-03',
    title: 'After You Dessert Cafe',
    category: 'Food & Dining',
    amount: -320,
    date: '2026-09-21',
    time: '16:40 PM',
    verifiedFromSlip: true,
    paymentMethod: 'PromptPay',
    slip: {
      bankName: 'KBank',
      bankCode: 'KBANK',
      slipType: 'K PLUS · e-Slip',
      status: 'โอนเงินสำเร็จ',
      amount: 320.0,
      senderName: 'นาย ธัญญ์พิสิษฐ์ โ.',
      recipientName: 'After You Cafe Co., Ltd.',
      recipientPromptPay: '0105550012991',
      refNo: 'KB-20260921-771122',
      dateTimeStr: '21/09/69 16:40'
    }
  },

  // 20 Sep 2026
  {
    id: 'tx-20-01',
    title: 'TrueVisions & Internet Fiber',
    category: 'Bills & Utilities',
    amount: -1290,
    date: '2026-09-20',
    time: '11:00 AM',
    verifiedFromSlip: true,
    paymentMethod: 'KBank Direct Debit',
    isRecurring: true,
    recurringFrequency: 'monthly',
    billingDay: 20,
    recurringLabel: 'Monthly Fiber & TV'
  },
  {
    id: 'tx-20-02',
    title: 'Gourmet Market Paragon',
    category: 'Shopping',
    amount: -1150,
    date: '2026-09-20',
    time: '14:20 PM',
    verifiedFromSlip: false,
    paymentMethod: 'Credit Card'
  },

  // 18 Sep 2026 (Friday Peak - high spending day ฿4,100)
  {
    id: 'tx-18-01',
    title: 'Shabu Shabu Shabushi Omotesando',
    category: 'Food & Dining',
    amount: -1850,
    date: '2026-09-18',
    time: '19:45 PM',
    verifiedFromSlip: true,
    paymentMethod: 'KBank Transfer',
    note: 'เลี้ยงวันเกิดเพื่อนร่วมงาน'
  },
  {
    id: 'tx-18-02',
    title: 'Zara Fashion Siam',
    category: 'Shopping',
    amount: -1450,
    date: '2026-09-18',
    time: '18:10 PM',
    verifiedFromSlip: true,
    paymentMethod: 'Credit Card'
  },
  {
    id: 'tx-18-03',
    title: 'Cocktail Bar Thonglor',
    category: 'Entertainment',
    amount: -800,
    date: '2026-09-18',
    time: '22:30 PM',
    verifiedFromSlip: true,
    paymentMethod: 'PromptPay'
  },

  // 15 Sep 2026
  {
    id: 'tx-15-01',
    title: 'Netflix & Spotify Premium',
    category: 'Entertainment',
    amount: -549,
    date: '2026-09-15',
    time: '01:00 AM',
    verifiedFromSlip: true,
    paymentMethod: 'Debit Card Auto',
    isRecurring: true,
    recurringFrequency: 'monthly',
    billingDay: 15,
    recurringLabel: 'Streaming Subscription'
  },
  {
    id: 'tx-15-02',
    title: 'Major Cineplex IMAX Ticket',
    category: 'Entertainment',
    amount: -491,
    date: '2026-09-15',
    time: '19:30 PM',
    verifiedFromSlip: true,
    paymentMethod: 'Line Pay'
  },

  // 14 Sep 2026
  {
    id: 'tx-14-01',
    title: 'MRT Subway Metro Monthly',
    category: 'Transport',
    amount: -1200,
    date: '2026-09-14',
    time: '08:00 AM',
    verifiedFromSlip: true,
    paymentMethod: 'PromptPay'
  },
  {
    id: 'tx-14-02',
    title: 'Kinokuniya Book CentralWorld',
    category: 'Shopping',
    amount: -780,
    date: '2026-09-14',
    time: '13:30 PM',
    verifiedFromSlip: false,
    paymentMethod: 'Credit Card'
  },

  // 10 Sep 2026
  {
    id: 'tx-10-01',
    title: 'MEA Electricity Bill (การไฟฟ้านครหลวง)',
    category: 'Bills & Utilities',
    amount: -2450,
    date: '2026-09-10',
    time: '10:00 AM',
    verifiedFromSlip: true,
    paymentMethod: 'KBank Bill Pay',
    isRecurring: true,
    recurringFrequency: 'monthly',
    billingDay: 10,
    recurringLabel: 'Monthly Electricity'
  },
  {
    id: 'tx-10-02',
    title: 'MWA Water Supply (การประปานครหลวง)',
    category: 'Bills & Utilities',
    amount: -300,
    date: '2026-09-10',
    time: '10:05 AM',
    verifiedFromSlip: true,
    paymentMethod: 'KBank Bill Pay'
  },

  // 07 Sep 2026
  {
    id: 'tx-07-01',
    title: 'GrabFood Suki Masa',
    category: 'Food & Dining',
    amount: -680,
    date: '2026-09-07',
    time: '12:30 PM',
    verifiedFromSlip: true,
    paymentMethod: 'GrabPay'
  },
  {
    id: 'tx-07-02',
    title: 'Grab Express Delivery',
    category: 'Transport',
    amount: -250,
    date: '2026-09-07',
    time: '15:20 PM',
    verifiedFromSlip: false,
    paymentMethod: 'PromptPay'
  },

  // 05 Sep 2026
  {
    id: 'tx-05-01',
    title: 'Muji Thailand Siam Discovery',
    category: 'Shopping',
    amount: -350,
    date: '2026-09-05',
    time: '17:00 PM',
    verifiedFromSlip: true,
    paymentMethod: 'PromptPay'
  },

  // 01 Sep 2026 (Monthly Salary + Initial Rent/Condo fee)
  {
    id: 'tx-01-01',
    title: 'Monthly Salary (เงินเดือนประจำ)',
    category: 'Income',
    amount: 27400,
    date: '2026-09-01',
    time: '09:00 AM',
    verifiedFromSlip: true,
    paymentMethod: 'Payroll Transfer',
    note: 'เงินเดือนสุทธิประจำเดือนกันยายน 2569'
  },
  {
    id: 'tx-01-02',
    title: 'Condominium Maintenance Fee',
    category: 'Bills & Utilities',
    amount: -1000,
    date: '2026-09-01',
    time: '10:00 AM',
    verifiedFromSlip: true,
    paymentMethod: 'KBank Transfer',
    isRecurring: true,
    recurringFrequency: 'monthly',
    billingDay: 1,
    recurringLabel: 'Condo Common Fee'
  },
  {
    id: 'tx-01-03',
    title: 'Dean & Deluca Breakfast',
    category: 'Food & Dining',
    amount: -340,
    date: '2026-09-01',
    time: '08:15 AM',
    verifiedFromSlip: false,
    paymentMethod: 'PromptPay'
  },
  {
    id: 'tx-01-04',
    title: 'AIS 5G Mobile Postpaid',
    category: 'Bills & Utilities',
    amount: -450,
    date: '2026-09-01',
    time: '11:30 AM',
    verifiedFromSlip: true,
    paymentMethod: 'Rabbit LINE Pay',
    isRecurring: true,
    recurringFrequency: 'monthly',
    billingDay: 1,
    recurringLabel: 'Mobile Plan'
  },
  {
    id: 'tx-01-05',
    title: 'Transport Tollway EasyPass',
    category: 'Transport',
    amount: -548,
    date: '2026-09-01',
    time: '16:00 PM',
    verifiedFromSlip: true,
    paymentMethod: 'KBank'
  }
];

export const CATEGORIES_DATA: CategorySummary[] = [
  {
    category: 'Food & Dining',
    amount: 5240,
    percentage: 65,
    count: 22,
    iconName: 'restaurant'
  },
  {
    category: 'Bills & Utilities',
    amount: 5040,
    percentage: 62,
    count: 6,
    iconName: 'receipt'
  },
  {
    category: 'Shopping',
    amount: 4620,
    percentage: 55,
    count: 10,
    iconName: 'shopping_bag'
  },
  {
    category: 'Transport',
    amount: 2180,
    percentage: 25,
    count: 7,
    iconName: 'directions_subway'
  },
  {
    category: 'Entertainment',
    amount: 1840,
    percentage: 22,
    count: 3,
    iconName: 'movie'
  }
];

export const WEEKLY_CADENCE = [
  { day: 'M', heightPercent: 25, amount: '฿1.2k', label: 'Monday' },
  { day: 'T', heightPercent: 50, amount: '฿2.4k', label: 'Tuesday' },
  { day: 'W', heightPercent: 30, amount: '฿1.5k', label: 'Wednesday' },
  { day: 'T', heightPercent: 55, amount: '฿2.6k', label: 'Thursday' },
  { day: 'F', heightPercent: 85, amount: '฿4.1k', label: 'Friday', isPeak: true },
  { day: 'S', heightPercent: 68, amount: '฿3.3k', label: 'Saturday' },
  { day: 'S', heightPercent: 35, amount: '฿1.7k', label: 'Sunday' }
];

export const MONTHLY_SPEND_DAYS = [
  { day: 1, amount: 2338, txCount: 5, height: 45 },
  { day: 2, amount: 240, txCount: 1, height: 15 },
  { day: 3, amount: 480, txCount: 2, height: 25 },
  { day: 4, amount: 620, txCount: 2, height: 30 },
  { day: 5, amount: 350, txCount: 1, height: 18 },
  { day: 6, amount: 510, txCount: 2, height: 26 },
  { day: 7, amount: 930, txCount: 2, height: 40 },
  { day: 8, amount: 420, txCount: 1, height: 20 },
  { day: 9, amount: 310, txCount: 1, height: 16 },
  { day: 10, amount: 2750, txCount: 2, height: 60 },
  { day: 11, amount: 390, txCount: 1, height: 18 },
  { day: 12, amount: 450, txCount: 1, height: 22 },
  { day: 13, amount: 680, txCount: 2, height: 32 },
  { day: 14, amount: 1980, txCount: 2, height: 50 },
  { day: 15, amount: 1040, txCount: 2, height: 38 },
  { day: 16, amount: 280, txCount: 1, height: 14 },
  { day: 17, amount: 490, txCount: 2, height: 24 },
  { day: 18, amount: 4100, txCount: 3, height: 80 },
  { day: 19, amount: 560, txCount: 2, height: 28 },
  { day: 20, amount: 2440, txCount: 2, height: 58 },
  { day: 21, amount: 522, txCount: 3, height: 26 },
  { day: 22, amount: 969, txCount: 2, height: 42 },
  { day: 23, amount: 710, txCount: 3, height: 70, isSelected: true },
  { day: 24, amount: 340, txCount: 1, height: 20 },
  { day: 25, amount: 410, txCount: 2, height: 22 },
  { day: 26, amount: 650, txCount: 2, height: 30 },
  { day: 27, amount: 480, txCount: 1, height: 24 },
  { day: 28, amount: 290, txCount: 1, height: 15 },
  { day: 29, amount: 520, txCount: 2, height: 25 },
  { day: 30, amount: 760, txCount: 2, height: 35 }
];

export const THANBAHT_MASCOT_URL = "https://lh3.googleusercontent.com/aida-public/AB6AXuD23s4biC1HPl0vxj5simjUzLcPPRo8ZvcDpE4WMl7mQfqlsdg2JfCKKdEqxZPzbO6nEyeN-u7Zro5S_QtM_lfrktHlTDF9htf4mZNYTgNfCmi7LKSP3E3swpVkqWOqHRNo1B3S5A2cqoQmfh--3ZaxJr4KzZ-EkkRM8bqwcQWnyUFDnG9vJ-4HpA3I9tTpiHCangjYzGNxCI-l0RQHoQaMIfUlOWnS-vrwqDxIp0f3dXNFyTns60AafcSP_AtSneKrIfY";
export const THANBAHT_MASCOT_FALLBACK = "https://lh3.googleusercontent.com/aida/AEtjO1WEXces5uD7wur2qsGaHnnOcLn7TbNKHwmGWKuB3QegdlJcB0-FBh_01ojqbtYzzk-Z7P7BC3Us_VnvLfeC133Ldf5SfQGnxJrbyckiccsAQqASiO1MAqzqzSMGuUm9PgUnLybyMOntrwWERf1dpOKX3OgOfEFvGmLoD5pruLwCcDbZndFIOrl75gyRtFPulyvtxuQ-V_-28jqyRrFPeDg8fJyqni92y1-gQ4DCvdbTtpopbUEPhNs2Oa5vWWUpNdo6hN02uAFYP0s";

export const INITIAL_SUBSCRIPTIONS: SubscriptionItem[] = [
  {
    id: 'sub-icloud',
    name: 'iCloud+ Storage',
    planName: '200GB Family Sharing',
    provider: 'Apple',
    category: 'Bills & Utilities',
    amount: 99,
    billingDay: 27,
    frequency: 'monthly',
    nextRenewalDate: '2026-09-27',
    status: 'active',
    paymentMethod: 'Apple Pay / KBank',
    iconName: 'cloud',
    color: '#007AFF',
    remindDaysBefore: 2
  },
  {
    id: 'sub-youtube',
    name: 'YouTube Premium',
    planName: 'Family Plan (Ad-free & Music)',
    provider: 'Google',
    category: 'Entertainment',
    amount: 299,
    billingDay: 28,
    frequency: 'monthly',
    nextRenewalDate: '2026-09-28',
    status: 'active',
    paymentMethod: 'TrueMoney Wallet',
    iconName: 'play_circle',
    color: '#FF0000',
    remindDaysBefore: 3
  },
  {
    id: 'sub-rabbit',
    name: 'Rabbit LINE Pay Mobile',
    planName: 'Unlimited 5G Max Speed',
    provider: 'LINE Pay',
    category: 'Bills & Utilities',
    amount: 499,
    billingDay: 1,
    frequency: 'monthly',
    nextRenewalDate: '2026-10-01',
    status: 'active',
    paymentMethod: 'Rabbit LINE Pay',
    iconName: 'smartphone',
    color: '#06C755',
    remindDaysBefore: 3
  },
  {
    id: 'sub-condo',
    name: 'Condo Common Fee',
    planName: 'Lumpini Park Monthly Juristic',
    provider: 'Condo Juristic',
    category: 'Bills & Utilities',
    amount: 1800,
    billingDay: 1,
    frequency: 'monthly',
    nextRenewalDate: '2026-10-01',
    status: 'active',
    paymentMethod: 'KBank Auto Transfer',
    iconName: 'apartment',
    color: '#5856D6',
    remindDaysBefore: 5
  },
  {
    id: 'sub-chatgpt',
    name: 'ChatGPT Plus',
    planName: 'GPT-4o & Canvas Access',
    provider: 'OpenAI',
    category: 'Entertainment',
    amount: 750,
    billingDay: 5,
    frequency: 'monthly',
    nextRenewalDate: '2026-10-05',
    status: 'active',
    paymentMethod: 'Debit Card',
    iconName: 'smart_toy',
    color: '#10A37F',
    remindDaysBefore: 3
  },
  {
    id: 'sub-mea',
    name: 'MEA Electricity Auto-Debit',
    planName: 'Bangkok Residence Electric',
    provider: 'MEA',
    category: 'Bills & Utilities',
    amount: 2450,
    billingDay: 10,
    frequency: 'monthly',
    nextRenewalDate: '2026-10-10',
    status: 'active',
    paymentMethod: 'KBank Bill Pay',
    iconName: 'bolt',
    color: '#FF9500',
    remindDaysBefore: 3
  },
  {
    id: 'sub-netflix',
    name: 'Netflix & Spotify Family',
    planName: '4K UHD + 5 Spotify Accounts',
    provider: 'Netflix',
    category: 'Entertainment',
    amount: 549,
    billingDay: 15,
    frequency: 'monthly',
    nextRenewalDate: '2026-10-15',
    status: 'active',
    paymentMethod: 'Debit Card Auto',
    iconName: 'tv',
    color: '#E50914',
    remindDaysBefore: 2
  },
  {
    id: 'sub-truevisions',
    name: 'TrueVisions & Fiber 1Gbps',
    planName: 'Giga Home Fiber & Sports TV',
    provider: 'True',
    category: 'Bills & Utilities',
    amount: 1290,
    billingDay: 20,
    frequency: 'monthly',
    nextRenewalDate: '2026-10-20',
    status: 'active',
    paymentMethod: 'Direct Debit',
    iconName: 'router',
    color: '#FF2D55',
    remindDaysBefore: 3
  }
];

