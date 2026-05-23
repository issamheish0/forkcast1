import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import { format } from 'date-fns'

interface ReportData {
  userStats: any
  bookingStats: any
  bookingRates: any
  platformRevenue: any
  customerDemographics: any
  kpi: any
  topRestaurants: any[]
  mostBookedUsers: any[]
  bookingFunnel: any[]
  recurringUsers: any[]
  waitingTimeStats: any
  byHour: any[]
  activationMetrics?: {
    completedBookingActivationRate: number
    anyBookingActivationRate: number
    totalNewUsers: number
    usersWithCompletedBooking: number
    usersWithAnyBooking: number
  }
  dateRange: { from: string; to: string }
}

export async function generateComprehensivePDF(data: ReportData) {
  const doc = new jsPDF('p', 'mm', 'a4')
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 15
  let yPos = margin
  const lineHeight = 7
  const sectionSpacing = 10

  // Helper function to add new page if needed
  const checkNewPage = (requiredSpace: number = 20) => {
    if (yPos + requiredSpace > pageHeight - margin) {
      doc.addPage()
      yPos = margin
      return true
    }
    return false
  }

  // Helper function to add text with word wrap
  const addText = (text: string, fontSize: number = 10, isBold: boolean = false, color: [number, number, number] = [0, 0, 0]) => {
    doc.setFontSize(fontSize)
    doc.setTextColor(color[0], color[1], color[2])
    if (isBold) {
      doc.setFont('helvetica', 'bold')
    } else {
      doc.setFont('helvetica', 'normal')
    }
    
    const maxWidth = pageWidth - 2 * margin
    const lines = doc.splitTextToSize(text, maxWidth)
    
    lines.forEach((line: string) => {
      checkNewPage(lineHeight)
      doc.text(line, margin, yPos)
      yPos += lineHeight
    })
  }

  // Helper function to add a section header
  const addSectionHeader = (title: string) => {
    checkNewPage(15)
    yPos += 5
    addText(title, 16, true, [0, 0, 0])
    yPos += 3
    doc.setLineWidth(0.5)
    doc.line(margin, yPos, pageWidth - margin, yPos)
    yPos += sectionSpacing
  }

  // Helper function to add a metric row
  const addMetricRow = (label: string, value: string | number, calculation?: string) => {
    checkNewPage(10)
    addText(`${label}:`, 10, true)
    const valueText = typeof value === 'number' ? value.toLocaleString() : value
    doc.text(valueText, margin + 60, yPos - lineHeight)
    if (calculation) {
      addText(`  Calculation: ${calculation}`, 8, false, [100, 100, 100])
    }
  }

  // Title Page
  addText('COMPREHENSIVE PERFORMANCE REPORT', 20, true, [0, 0, 0])
  yPos += 5
  addText(`First Month Performance Analysis`, 14, true, [50, 50, 50])
  yPos += 5
  addText(`Period: ${format(new Date(data.dateRange.from), 'MMMM dd, yyyy')} - ${format(new Date(data.dateRange.to), 'MMMM dd, yyyy')}`, 12)
  yPos += 10
  addText(`Generated: ${format(new Date(), 'MMMM dd, yyyy HH:mm')}`, 10, false, [100, 100, 100])
  yPos += 15
  addText('This report contains detailed analytics, metrics, and performance indicators for the first month of operations.', 10)
  yPos += 20

  // Table of Contents
  addSectionHeader('TABLE OF CONTENTS')
  const toc = [
    '1. Executive Summary',
    '2. User Analytics',
    '2.1 User Activation Analysis (30-Day Activation Rate)',
    '3. Booking Analytics',
    '4. Booking Rates & Funnel',
    '5. Revenue Analysis',
    '6. Customer Demographics',
    '7. Top Performing Restaurants',
    '8. Most Active Users',
    '9. Recurring Users Analysis',
    '10. Peak Hours Analysis',
    '11. Waiting Time Statistics',
    '12. Key Insights & Recommendations',
    '13. Calculation Methodology'
  ]
  toc.forEach((item, index) => {
    addText(item, 10)
  })
  doc.addPage()
  yPos = margin

  // 1. Executive Summary
  addSectionHeader('1. EXECUTIVE SUMMARY')
  if (data.userStats) {
    addMetricRow('Total Users', data.userStats.total_users, 'Count of all user profiles in the system')
    addMetricRow('New Users (7 days)', data.userStats.new_users_7d, 'Users who joined in the last 7 days')
    addMetricRow('Active Users (Daily)', data.userStats.active_users_daily, 'Users active in the last 24 hours')
    addMetricRow('Users with Bookings', data.userStats.users_with_bookings, 'Users who have made at least one booking')
  }
  yPos += 5
  if (data.bookingStats) {
    addMetricRow('Total Bookings', data.bookingStats.total_bookings, 'All booking requests created')
    addMetricRow('Completed Bookings', data.bookingStats.completed_bookings, 'Bookings with status = "completed"')
    addMetricRow('Total Covers', data.bookingStats.total_covers, 'Sum of party_size for all bookings')
  }
  yPos += 5
  if (data.platformRevenue) {
    addMetricRow('Estimated Revenue (USD)', `$${data.platformRevenue.total_estimated_revenue_usd?.toFixed(2)}`, 
      'Basic tier: $1 per cover, Pro tier: $0.70 per cover (only completed bookings)')
  }

  // 2. User Analytics
  checkNewPage(30)
  addSectionHeader('2. USER ANALYTICS')
  if (data.userStats) {
    addText('User Growth Metrics:', 12, true)
    yPos += 2
    addMetricRow('Total Users', data.userStats.total_users)
    addMetricRow('New Users (Last 7 Days)', data.userStats.new_users_7d)
    addMetricRow('New Users (Today)', data.userStats.new_users_today || 0)
    addMetricRow('New Users (Yesterday)', data.userStats.new_users_yesterday || 0)
    yPos += 5
    addText('User Activity Metrics:', 12, true)
    yPos += 2
    addMetricRow('Active Users (Daily)', data.userStats.active_users_daily, 'Users who performed any action in last 24 hours')
    addMetricRow('Active Users (Weekly)', data.userStats.active_users_weekly, 'Users active in last 7 days')
    addMetricRow('Active Users (Monthly)', data.userStats.active_users_monthly, 'Users active in last 30 days')
    addMetricRow('Users with Bookings', data.userStats.users_with_bookings, 'Users who have created at least one booking')
  }
  
  // 2.1 User Activation Analysis (30-Day Activation Rate)
  checkNewPage(30)
  addSectionHeader('2.1 USER ACTIVATION ANALYSIS (30-DAY ACTIVATION RATE)')
  if (data.activationMetrics) {
    addText('This metric analyzes user activation by tracking whether users made their FIRST booking within their first 30 days after joining.', 10, false, [50, 50, 50])
    yPos += 5
    addText('Key Insights:', 12, true)
    yPos += 2
    addMetricRow('Total Users Evaluated', data.activationMetrics.totalNewUsers, 
      'Users who joined 30+ days ago OR already made their first booking')
    addMetricRow('Users with Any Booking (30 days)', data.activationMetrics.usersWithAnyBooking, 
      'Users whose FIRST booking was within 30 days of joining (any status)')
    addMetricRow('Users with Completed Booking (30 days)', data.activationMetrics.usersWithCompletedBooking, 
      'Users whose FIRST booking was completed within 30 days of joining')
    yPos += 5
    addText('Activation Rates:', 12, true)
    yPos += 2
    const anyRate = data.activationMetrics.totalNewUsers > 0 
      ? (data.activationMetrics.usersWithAnyBooking / data.activationMetrics.totalNewUsers * 100).toFixed(2)
      : '0.00'
    const completedRate = data.activationMetrics.totalNewUsers > 0
      ? (data.activationMetrics.usersWithCompletedBooking / data.activationMetrics.totalNewUsers * 100).toFixed(2)
      : '0.00'
    addMetricRow('Any Booking Activation Rate', `${anyRate}%`, 
      '(Users with first booking in 30 days / Total users evaluated) × 100')
    addMetricRow('Completed Booking Activation Rate', `${completedRate}%`, 
      '(Users with first completed booking in 30 days / Total users evaluated) × 100')
    yPos += 5
    addText('Analysis:', 10, true, [0, 100, 200])
    addText(`  • ${anyRate}% of users made their first booking attempt within 30 days of joining`, 9, false, [50, 50, 50])
    addText(`  • ${completedRate}% of users completed their first booking within 30 days of joining`, 9, false, [50, 50, 50])
    const gap = (parseFloat(anyRate) - parseFloat(completedRate)).toFixed(2)
    addText(`  • ${gap}% gap indicates users who attempted but didn't complete their first booking`, 9, false, [50, 50, 50])
    addText('  • This metric helps identify user onboarding effectiveness and early engagement', 9, false, [50, 50, 50])
  } else {
    addText('Activation metrics not available for this period', 10, false, [150, 150, 150])
  }

  // 3. Booking Analytics
  checkNewPage(30)
  addSectionHeader('3. BOOKING ANALYTICS')
  if (data.bookingStats) {
    addText('Booking Volume:', 12, true)
    yPos += 2
    addMetricRow('Total Bookings', data.bookingStats.total_bookings, 'All booking records in the system')
    addMetricRow('Bookings (Last 7 Days)', data.bookingStats.bookings_7d || 0)
    addMetricRow('Bookings (Today)', data.bookingStats.bookings_today || 0)
    yPos += 5
    addText('Booking Status Breakdown:', 12, true)
    yPos += 2
    addMetricRow('Completed Bookings', data.bookingStats.completed_bookings)
    addMetricRow('Cancelled Bookings', data.bookingStats.cancelled_bookings)
    addMetricRow('No-Show Bookings', data.bookingStats.no_show_bookings)
    yPos += 5
    addText('Cover Metrics:', 12, true)
    yPos += 2
    addMetricRow('Total Covers', data.bookingStats.total_covers, 'Sum of party_size for all bookings')
    addMetricRow('Average Party Size', data.bookingStats.avg_party_size?.toFixed(2) || '0', 
      'Total covers / Total bookings')
    addMetricRow('Completed Covers', data.bookingStats.completed_covers || 0, 
      'Sum of party_size for completed bookings only')
  }

  // 4. Booking Rates & Funnel
  checkNewPage(30)
  addSectionHeader('4. BOOKING RATES & FUNNEL')
  if (data.bookingRates) {
    addText('Conversion Rates:', 12, true)
    yPos += 2
    addMetricRow('Completion Rate', `${data.bookingRates.completion_rate_pct?.toFixed(2)}%`, 
      '(Completed bookings / Total bookings) × 100')
    addMetricRow('Cancellation Rate', `${data.bookingRates.cancellation_rate_pct?.toFixed(2)}%`, 
      '((Cancelled by user + Cancelled by restaurant) / Total bookings) × 100')
    addMetricRow('No-Show Rate', `${data.bookingRates.no_show_rate_pct?.toFixed(2)}%`, 
      '(No-show bookings / Total bookings) × 100')
  }
  yPos += 5
  if (data.bookingFunnel && data.bookingFunnel.length > 0) {
    addText('Booking Funnel Analysis:', 12, true)
    yPos += 2
    data.bookingFunnel.slice(0, 10).forEach((stage: any, index: number) => {
      addText(`${index + 1}. ${stage.stage || 'Unknown'}: ${stage.count || 0} bookings`, 10)
    })
  }

  // 5. Revenue Analysis
  checkNewPage(30)
  addSectionHeader('5. REVENUE ANALYSIS')
  if (data.platformRevenue) {
    addText('Platform Revenue Breakdown:', 12, true)
    yPos += 2
    addMetricRow('Total Estimated Revenue', `$${data.platformRevenue.total_estimated_revenue_usd?.toFixed(2)}`, 
      'Sum of revenue from all completed bookings')
    addMetricRow('Basic Tier Restaurants', data.platformRevenue.basic_restaurants || 0, 
      'Count of restaurants on basic tier')
    addMetricRow('Pro Tier Restaurants', data.platformRevenue.pro_restaurants || 0, 
      'Count of restaurants on pro tier')
    addMetricRow('Total Completed Bookings', data.platformRevenue.total_completed_bookings || 0)
    addMetricRow('Total Completed Covers', data.platformRevenue.total_completed_covers || 0)
    yPos += 5
    addText('Revenue Calculation:', 10, false, [100, 100, 100])
    addText('  • Basic Tier: $1.00 per completed cover', 9, false, [100, 100, 100])
    addText('  • Pro Tier: $0.70 per completed cover', 9, false, [100, 100, 100])
    addText('  • Only completed bookings are counted', 9, false, [100, 100, 100])
  }

  // 6. Customer Demographics
  checkNewPage(30)
  addSectionHeader('6. CUSTOMER DEMOGRAPHICS')
  if (data.customerDemographics) {
    addMetricRow('Total Customers', data.customerDemographics.total_customers)
    addMetricRow('Average Age', data.customerDemographics.avg_age?.toFixed(1) || 'N/A', 
      'Average age of customers with age data')
    addMetricRow('Customers with Age Data', data.customerDemographics.customers_with_age_data || 0)
    addMetricRow('Customers with Bookings', data.customerDemographics.customers_with_bookings || 0)
    addMetricRow('Average Party Size per Booking', data.customerDemographics.avg_party_size_per_booking?.toFixed(2) || '0', 
      'Total covers / Total bookings')
  }

  // 7. Top Performing Restaurants
  checkNewPage(30)
  addSectionHeader('7. TOP PERFORMING RESTAURANTS')
  if (data.topRestaurants && data.topRestaurants.length > 0) {
    addText('Top 10 Restaurants by Booking Volume:', 12, true)
    yPos += 5
    data.topRestaurants.slice(0, 10).forEach((restaurant: any, index: number) => {
      checkNewPage(15)
      addText(`${index + 1}. ${restaurant.name || 'Unknown'}`, 10, true)
      addText(`   Tier: ${restaurant.tier || 'N/A'} | Total Bookings: ${restaurant.total_bookings || 0} | Completed: ${restaurant.completed_bookings || 0} | Covers: ${restaurant.total_covers || 0}`, 9, false, [100, 100, 100])
      yPos += 2
    })
  } else {
    addText('No restaurant data available', 10, false, [150, 150, 150])
  }

  // 8. Most Active Users
  checkNewPage(30)
  addSectionHeader('8. MOST ACTIVE USERS')
  if (data.mostBookedUsers && data.mostBookedUsers.length > 0) {
    addText('Top 10 Users by Booking Count:', 12, true)
    yPos += 5
    data.mostBookedUsers.slice(0, 10).forEach((user: any, index: number) => {
      checkNewPage(15)
      addText(`${index + 1}. ${user.full_name || 'Unknown'}`, 10, true)
      addText(`   Email: ${user.email || 'N/A'} | Total Bookings: ${user.total_bookings || 0} | Completed: ${user.completed_bookings || 0} | Covers: ${user.total_covers || 0}`, 9, false, [100, 100, 100])
      yPos += 2
    })
  } else {
    addText('No user data available', 10, false, [150, 150, 150])
  }

  // 9. Recurring Users Analysis
  checkNewPage(30)
  addSectionHeader('9. RECURRING USERS ANALYSIS')
  if (data.recurringUsers && data.recurringUsers.length > 0) {
    addText('Users with Multiple Bookings (Last 20 Days):', 12, true)
    yPos += 5
    addText(`Total Recurring Users: ${data.recurringUsers.length}`, 10, true)
    yPos += 3
    data.recurringUsers.slice(0, 10).forEach((user: any, index: number) => {
      checkNewPage(15)
      addText(`${index + 1}. ${user.full_name || 'Unknown'}`, 10, true)
      addText(`   Bookings: ${user.bookings_past_20d || 0} | Covers: ${user.covers_past_20d || 0}`, 9, false, [100, 100, 100])
      yPos += 2
    })
  } else {
    addText('No recurring user data available', 10, false, [150, 150, 150])
  }

  // 10. Peak Hours Analysis
  checkNewPage(30)
  addSectionHeader('10. PEAK HOURS ANALYSIS')
  if (data.byHour && data.byHour.length > 0) {
    addText('Booking Distribution by Hour:', 12, true)
    yPos += 5
    const sortedHours = [...data.byHour].sort((a, b) => b.count - a.count)
    const peakHour = sortedHours[0]
    addText(`Peak Hour: ${peakHour.hour}:00 with ${peakHour.count} bookings`, 10, true)
    yPos += 5
    addText('Top 5 Booking Hours:', 10, true)
    yPos += 2
    sortedHours.slice(0, 5).forEach((hour: any, index: number) => {
      addText(`${index + 1}. ${hour.hour}:00 - ${hour.count} bookings`, 10)
    })
  } else {
    addText('No peak hour data available', 10, false, [150, 150, 150])
  }

  // 11. Waiting Time Statistics
  checkNewPage(30)
  addSectionHeader('11. WAITING TIME STATISTICS')
  if (data.waitingTimeStats) {
    const avgMinutes = data.waitingTimeStats.avg_response_time_minutes || 0
    const avgHours = data.waitingTimeStats.avg_response_time_hours || 0
    const bookingsCount = data.waitingTimeStats.bookings_count || 0
    const confirmedCount = data.waitingTimeStats.confirmed_count || 0
    const minMinutes = data.waitingTimeStats.min_response_minutes || 0
    const maxMinutes = data.waitingTimeStats.max_response_minutes || 0
    
    addText('Response Time Metrics:', 12, true)
    yPos += 2
    addMetricRow('Average Response Time', `${avgMinutes} minutes (${avgHours.toFixed(2)} hours)`, 
      'Average time between booking creation and confirmation/decline')
    addMetricRow('Fastest Response Time', `${minMinutes} minutes`, 
      'Minimum time between booking creation and response')
    addMetricRow('Slowest Response Time', `${maxMinutes} minutes`, 
      'Maximum time between booking creation and response')
    yPos += 5
    addText('Booking Statistics:', 12, true)
    yPos += 2
    addMetricRow('Total Bookings Analyzed', bookingsCount, 
      'Bookings that received a response (confirmed, declined, or cancelled by restaurant)')
    addMetricRow('Confirmed Bookings', confirmedCount, 
      'Bookings that were confirmed')
    addMetricRow('Declined Bookings', data.waitingTimeStats.declined_count || 0, 
      'Bookings that were declined or cancelled by restaurant')
  } else {
    addText('No waiting time data available', 10, false, [150, 150, 150])
  }

  // 12. Key Insights & Recommendations
  checkNewPage(50)
  addSectionHeader('12. KEY INSIGHTS & RECOMMENDATIONS')
  
  // Calculate insights based on data
  const insights: string[] = []
  const recommendations: string[] = []
  
  if (data.bookingRates) {
    const completionRate = data.bookingRates.completion_rate_pct || 0
    const cancellationRate = data.bookingRates.cancellation_rate_pct || 0
    const noShowRate = data.bookingRates.no_show_rate_pct || 0
    
    insights.push(`Completion Rate: ${completionRate.toFixed(2)}% - ${completionRate >= 70 ? 'Strong performance' : completionRate >= 50 ? 'Moderate performance' : 'Needs improvement'}`)
    insights.push(`Cancellation Rate: ${cancellationRate.toFixed(2)}% - ${cancellationRate <= 20 ? 'Acceptable level' : 'Higher than ideal'}`)
    insights.push(`No-Show Rate: ${noShowRate.toFixed(2)}% - ${noShowRate <= 10 ? 'Good' : 'Requires attention'}`)
    
    if (cancellationRate > 30) {
      recommendations.push('High cancellation rate detected. Consider implementing reminder notifications and flexible cancellation policies.')
    }
    if (noShowRate > 15) {
      recommendations.push('No-show rate is elevated. Implement confirmation reminders and consider deposit requirements for high-value bookings.')
    }
    if (completionRate < 60) {
      recommendations.push('Completion rate below optimal. Focus on improving booking confirmation process and customer communication.')
    }
  }
  
  if (data.activationMetrics) {
    const activationRate = data.activationMetrics.totalNewUsers > 0 
      ? (data.activationMetrics.usersWithAnyBooking / data.activationMetrics.totalNewUsers * 100)
      : 0
    insights.push(`User Activation Rate: ${activationRate.toFixed(2)}% - ${activationRate >= 40 ? 'Strong user engagement' : 'Opportunity for improvement'}`)
    
    if (activationRate < 30) {
      recommendations.push('Low activation rate suggests onboarding improvements needed. Consider welcome emails, tutorials, or promotional offers for new users.')
    }
  }
  
  if (data.userStats) {
    const bookingConversionRate = data.userStats.total_users > 0
      ? (data.userStats.users_with_bookings / data.userStats.total_users * 100)
      : 0
    insights.push(`User-to-Booking Conversion: ${bookingConversionRate.toFixed(2)}% of users have made at least one booking`)
    
    if (bookingConversionRate < 50) {
      recommendations.push('Less than half of users have made bookings. Focus on user engagement strategies and reducing barriers to first booking.')
    }
  }
  
  if (data.topRestaurants && data.topRestaurants.length > 0) {
    const topRestaurant = data.topRestaurants[0]
    insights.push(`Top Restaurant: ${topRestaurant.name} leads with ${topRestaurant.total_bookings} total bookings`)
    recommendations.push(`Analyze top-performing restaurant strategies and replicate successful practices across the platform.`)
  }
  
  if (data.recurringUsers && data.recurringUsers.length > 0) {
    const recurringRate = data.userStats?.users_with_bookings > 0
      ? (data.recurringUsers.length / data.userStats.users_with_bookings * 100)
      : 0
    insights.push(`Recurring User Rate: ${recurringRate.toFixed(2)}% - ${recurringRate >= 20 ? 'Strong retention' : 'Focus on retention strategies'}`)
    
    if (recurringRate < 15) {
      recommendations.push('Low recurring user rate. Implement loyalty programs, personalized recommendations, and post-booking follow-ups.')
    }
  }
  
  if (data.byHour && data.byHour.length > 0) {
    const sortedHours = [...data.byHour].sort((a, b) => b.count - a.count)
    const peakHour = sortedHours[0]
    const offPeakHours = sortedHours.slice(-5)
    insights.push(`Peak Booking Hour: ${peakHour.hour}:00 with ${peakHour.count} bookings`)
    recommendations.push(`Optimize staffing and table availability during peak hours (${peakHour.hour}:00). Consider promotions for off-peak hours to balance demand.`)
  }
  
  addText('Key Insights:', 12, true)
  yPos += 3
  insights.forEach((insight, index) => {
    checkNewPage(10)
    addText(`${index + 1}. ${insight}`, 10)
    yPos += 2
  })
  
  yPos += 5
  addText('Strategic Recommendations:', 12, true)
  yPos += 3
  recommendations.forEach((rec, index) => {
    checkNewPage(10)
    addText(`${index + 1}. ${rec}`, 10, false, [0, 100, 200])
    yPos += 2
  })
  
  // 13. Calculation Methodology
  checkNewPage(50)
  addSectionHeader('13. CALCULATION METHODOLOGY')
  addText('This section explains how each metric is calculated:', 10, true)
  yPos += 5
  
  const methodologies = [
    {
      metric: 'Total Users',
      calculation: 'COUNT(*) FROM profiles'
    },
    {
      metric: 'New Users (7d)',
      calculation: 'COUNT(*) FROM profiles WHERE created_at >= NOW() - INTERVAL \'7 days\''
    },
    {
      metric: 'Active Users (Daily)',
      calculation: 'Users who performed any action (booking, login, etc.) in the last 24 hours'
    },
    {
      metric: 'Total Bookings',
      calculation: 'COUNT(*) FROM bookings WHERE booking_time BETWEEN date_range'
    },
    {
      metric: 'Completed Bookings',
      calculation: 'COUNT(*) FROM bookings WHERE status = \'completed\''
    },
    {
      metric: 'Total Covers',
      calculation: 'SUM(party_size) FROM bookings'
    },
    {
      metric: 'Completion Rate',
      calculation: '(Completed bookings / Total bookings) × 100'
    },
    {
      metric: 'Cancellation Rate',
      calculation: '((Cancelled by user + Cancelled by restaurant) / Total bookings) × 100'
    },
    {
      metric: 'No-Show Rate',
      calculation: '(No-show bookings / Total bookings) × 100'
    },
    {
      metric: 'Estimated Revenue',
      calculation: 'Basic tier: $1.00 per completed cover | Pro tier: $0.70 per completed cover'
    },
    {
      metric: 'Average Party Size',
      calculation: 'Total covers / Total bookings'
    },
    {
      metric: 'Peak Hour',
      calculation: 'Hour with the highest number of bookings (by booking_time)'
    },
    {
      metric: '30-Day Activation Rate',
      calculation: 'Users whose FIRST booking was within 30 days of joining / Total users evaluated × 100'
    },
    {
      metric: 'User-to-Booking Conversion',
      calculation: 'Users with at least one booking / Total users × 100'
    },
    {
      metric: 'Recurring User Rate',
      calculation: 'Users with multiple bookings / Users with bookings × 100'
    }
  ]

  methodologies.forEach((method, index) => {
    checkNewPage(20)
    addText(`${method.metric}:`, 10, true)
    addText(`  ${method.calculation}`, 9, false, [100, 100, 100])
    yPos += 3
  })

  // Footer on last page
  const totalPages = (doc as any).internal.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    doc.text(`Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' })
    doc.text(`Generated: ${format(new Date(), 'MMM dd, yyyy HH:mm')}`, margin, pageHeight - 10)
  }

  // Save PDF
  const filename = `First-Month-Report-${format(new Date(data.dateRange.from), 'MMM-dd')}-to-${format(new Date(data.dateRange.to), 'MMM-dd')}.pdf`
  doc.save(filename)
}

