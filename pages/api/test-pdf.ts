import { generateLoiPdf } from './eli5-engine/pdfGenerator';

import type { NextApiRequest, NextApiResponse } from 'next';


export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    console.log('Starting PDF generation test...');
    
    // Test data - minimal required fields
    const testData = {
      property: {
        address: '123 Test St',
        // Add other required fields that your template expects
        city: 'Test City',
        state: 'TS',
        zip: '12345',
        purchasePrice: 250000,
        county: 'Test County',
        yearBuilt: 2000,
        squareFeet: 2000,
        bedrooms: 3,
        bathrooms: 2,
        lotSize: 0.5,
        afterRepairValue: 350000,
        repairCosts: 50000,
        closingCosts: 10000,
        monthlyRent: 2500,
        propertyTaxes: 3000,
        insurance: 1200,
        propertyManagement: 250,
        maintenance: 150,
        vacancyRate: 5,
        capRate: 7.5,
        cashOnCashReturn: 12.5,
        grossRentMultiplier: 10.5,
        debtServiceCoverageRatio: 1.25,
        loanAmount: 200000,
        interestRate: 4.5,
        loanTerm: 30,
        downPayment: 50000,
        loanFees: 2000,
        monthlyPayment: 1013.37,
        totalInvestment: 112000,
        annualCashFlow: 12000,
        totalCashNeeded: 112000,
        netOperatingIncome: 18000,
        operatingExpenses: 12000,
        mortgagePayment: 12160.44,
        estimatedRepairCosts: 50000,
        estimatedClosingCosts: 10000,
        estimatedMonthlyRent: 2500,
        estimatedPropertyTaxes: 3000,
        estimatedInsurance: 1200,
        estimatedPropertyManagement: 3000,
        estimatedMaintenance: 1800,
        estimatedVacancyRate: 5,
        estimatedCapRate: 7.5,
        estimatedCashOnCashReturn: 12.5,
        estimatedGrossRentMultiplier: 10.5,
        estimatedDebtServiceCoverageRatio: 1.25,
        estimatedLoanAmount: 200000,
        estimatedInterestRate: 4.5,
        estimatedLoanTerm: 30,
        estimatedDownPayment: 50000,
        estimatedLoanFees: 2000,
        estimatedMonthlyPayment: 1013.37,
        estimatedNetOperatingIncome: 18000,
        estimatedOperatingExpenses: 12000,
        estimatedMortgagePayment: 12160.44,
        estimatedMonthlyExpenses: 1000,
        estimatedMonthlyCashFlow: 1000,
        estimatedTotalCashNeeded: 120000,
        estimatedTotalInvestment: 120000,
        estimatedTotalReturn: 12000,
        estimatedTotalReturnPercentage: 10,
        estimatedTotalReturnOnInvestment: 10,
        estimatedTotalReturnOnInvestmentPercentage: 10,
        estimatedTotalReturnOnInvestmentAnnualized: 10,
        estimatedTotalReturnOnInvestmentAnnualizedPercentage: 10,
        estimatedTotalReturnOnInvestmentAnnualizedCumulative: 10,
        estimatedTotalReturnOnInvestmentAnnualizedCumulativePercentage: 10,
        estimatedTotalReturnOnInvestmentAnnualizedCumulativeWithReinvestment: 10,
        estimatedTotalReturnOnInvestmentAnnualizedCumulativeWithReinvestmentPercentage: 10,
        estimatedTotalReturnOnInvestmentAnnualizedCumulativeWithReinvestmentAndAppreciation: 10,
        estimatedTotalReturnOnInvestmentAnnualizedCumulativeWithReinvestmentAndAppreciationPercentage: 10,
        estimatedTotalReturnOnInvestmentAnnualizedCumulativeWithReinvestmentAndAppreciationAndTaxSavings: 10,
        estimatedTotalReturnOnInvestmentAnnualizedCumulativeWithReinvestmentAndAppreciationAndTaxSavingsPercentage: 10,
        estimatedTotalReturnOnInvestmentAnnualizedCumulativeWithReinvestmentAndAppreciationAndTaxSavingsAndInflation: 10,
        estimatedTotalReturnOnInvestmentAnnualizedCumulativeWithReinvestmentAndAppreciationAndTaxSavingsAndInflationPercentage: 10,
        estimatedTotalReturnOnInvestmentAnnualizedCumulativeWithReinvestmentAndAppreciationAndTaxSavingsAndInflationAndOpportunityCost: 10,
        estimatedTotalReturnOnInvestmentAnnualizedCumulativeWithReinvestmentAndAppreciationAndTaxSavingsAndInflationAndOpportunityCostPercentage: 10,
      },
      contact: {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phone: '(555) 123-4567',
        company: 'Test Company',
        address: '123 Business St',
        city: 'Business City',
        state: 'BC',
        zip: '54321',
        website: 'www.testcompany.com',
        licenseNumber: '123456789',
        licenseState: 'BC',
        licenseExpiration: '2025-12-31',
        licenseType: 'Broker',
        licenseStatus: 'Active',
        licenseIssueDate: '2020-01-01',
        licenseRenewalDate: '2025-01-01',
        licenseBoard: 'Test Board',
        licenseBoardPhone: '(555) 987-6543',
        licenseBoardEmail: 'info@testboard.com',
        licenseBoardWebsite: 'www.testboard.com',
        licenseBoardAddress: '123 Board St',
        licenseBoardCity: 'Board City',
        licenseBoardState: 'BC',
        licenseBoardZip: '54321',
        licenseBoardFax: '(555) 987-6544',
      },
      user: {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@example.com',
        phone: '(555) 987-6543',
        company: 'Smith Investments',
        address: '456 Investment Ave',
        city: 'Investor City',
        state: 'IC',
        zip: '67890',
        website: 'www.smithinvestments.com',
        licenseNumber: '987654321',
        licenseState: 'IC',
        licenseExpiration: '2026-12-31',
        licenseType: 'Investor',
        licenseStatus: 'Active',
        licenseIssueDate: '2021-01-01',
        licenseRenewalDate: '2026-01-01',
        licenseBoard: 'Investor Board',
        licenseBoardPhone: '(555) 123-4567',
        licenseBoardEmail: 'info@investorboard.com',
        licenseBoardWebsite: 'www.investorboard.com',
        licenseBoardAddress: '789 Boardwalk',
        licenseBoardCity: 'Boardwalk City',
        licenseBoardState: 'BC',
        licenseBoardZip: '67890',
        licenseBoardFax: '(555) 123-4568',
      },
      offer: {
        purchasePrice: 250000,
        earnestMoney: 5000,
        downPayment: 50000,
        loanAmount: 200000,
        interestRate: 4.5,
        loanTerm: 30,
        loanType: 'Conventional',
        closingDate: '2023-12-31',
        inspectionPeriod: 10,
        financingContingency: 30,
        appraisalContingency: 15,
        otherTerms: 'Seller to pay up to $5,000 in closing costs.',
        offerExpiration: '2023-11-30',
        offerDate: '2023-11-15',
        offerStatus: 'Pending',
        offerNotes: 'This is a test offer.',
      },
    };

    // Generate PDF
    const pdfBuffer = await generateLoiPdf(
      testData,
      'test-lead-123',
      'test@example.com'
    );

    if (!pdfBuffer) {
      throw new Error('Failed to generate PDF');
    }

    console.log('PDF generated successfully');

    // Set headers for PDF response
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename=test-letter-of-intent.pdf');
    
    // Send the PDF
    res.status(200).send(pdfBuffer);
  } catch (error) {
    console.error('PDF generation failed:', error);
    res.status(500).json({ 
      error: 'Failed to generate PDF',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
