 // Get the primary contact (first available with email) and their type
  const getPrimaryContact = (lead: NormalizedLead) => {
    if (lead.contact1_email_1 && lead.contact1_email_1.includes('@')) {
      return {
        name: lead.contact1_name,
        email: lead.contact1_email_1,
        type: 'Owner',
        contactType: 'owner1',
        status: lead.status || 'UNCONTACTED'
      };
    }
    if (lead.contact2_email_1 && lead.contact2_email_1.includes('@')) {
      return {
        name: lead.contact2_name,
        email: lead.contact2_email_1,
        type: 'Owner',
        contactType: 'owner2',
        status: lead.status || 'UNCONTACTED'
      };
    }
    if (lead.contact3_email_1 && lead.contact3_email_1.includes('@')) {
      return {
        name: lead.contact3_name,
        email: lead.contact3_email_1,
        type: 'Owner',
        contactType: 'owner3'
      };
    }
    if (lead.mls_curr_list_agent_email && lead.mls_curr_list_agent_email.includes('@')) {
      return {
        name: lead.mls_curr_list_agent_name,
        email: lead.mls_curr_list_agent_email,
        type: 'Agent',
        contactType: 'agent'
      };
    }
    return null;
  };

  // Filter leads by selected market region and search term
  const filteredLeads = useMemo(() => {
    let result = [...leads];
    
    // Apply market region filter
    if (filterMarketRegion && filterMarketRegion !== 'All') {
      result = result.filter(lead => lead.market_region === filterMarketRegion);
    }
    
    // Apply search term filter
    if (tableSearchTerm) {
      const searchLower = tableSearchTerm.toLowerCase();
      result = result.filter(lead => {
        return (
          (lead.contact1_name?.toLowerCase().includes(searchLower)) ||
          (lead.contact1_email_1?.toLowerCase().includes(searchLower)) ||
          (lead.contact2_name?.toLowerCase().includes(searchLower)) ||
          (lead.contact2_email_1?.toLowerCase().includes(searchLower)) ||
          (lead.property_address?.toLowerCase().includes(searchLower)) ||
          (lead.property_city?.toLowerCase().includes(searchLower)) ||
          (lead.property_state?.toLowerCase().includes(searchLower)) ||
          (lead.market_region?.toLowerCase().includes(searchLower)) ||
          (lead.status?.toLowerCase().includes(searchLower)) ||
          (lead.notes?.toLowerCase().includes(searchLower))
        );
      });
    }
    
    return result;
  }, [leads, filterMarketRegion, tableSearchTerm]);