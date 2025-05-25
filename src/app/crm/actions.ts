"use server";

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';

import type { CrmLead } from '@/types/crm'; // Import CrmLead from the centralized types file

interface ServerActionResponse<T = CrmLead | CrmLead[]> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Action to CREATE a new CRM lead
export async function createCrmLeadAction(newLeadData: Partial<Omit<CrmLead, 'id' | 'created_at' | 'updated_at'>>): Promise<ServerActionResponse<CrmLead>> {
  const supabase = await createClient();
  console.log('Server Action createCrmLeadAction called with:', newLeadData);

  if (!newLeadData.contact_type) {
    return { success: false, error: 'Contact type is required.' };
  }


  try {
    const { data, error } = await supabase
      .from('crm_leads')
      .insert([newLeadData]) // Supabase expects an array for insert
      .select()
      .single(); // Expecting a single record back

    if (error) {
      console.error('Error creating CRM lead:', error);
      return { success: false, error: error.message };
    }

    if (data) {
      revalidatePath('/crm'); // Revalidate the CRM page to show the new lead
      return { success: true, data: data as CrmLead, message: 'Lead created successfully.' };
    }
    return { success: false, error: 'Failed to create lead or retrieve created data.' };

  } catch (e: any) {
    console.error('Exception in createCrmLeadAction:', e);
    return { success: false, error: e.message || 'An unexpected error occurred.' };
  }
}

// Action to UPDATE an existing CRM lead
export async function updateCrmLeadAction(leadId: number, updatedLeadData: Partial<Omit<CrmLead, 'id' | 'created_at'>>): Promise<ServerActionResponse<CrmLead>> {
  const supabase = await createClient();
  console.log(`Server Action updateCrmLeadAction called for ID ${leadId} with:`, updatedLeadData);

  if (!leadId) {
    return { success: false, error: 'Lead ID is required for an update.' };
  }

  // Remove id, created_at from updatedLeadData if they exist, as they shouldn't be updated directly
  const { id, created_at, ...updateData } = updatedLeadData as any;
  updateData.updated_at = new Date().toISOString(); // Explicitly set updated_at

  try {
    const { data, error } = await supabase
      .from('crm_leads')
      .update(updateData)
      .eq('id', leadId)
      .select()
      .single();

    if (error) {
      console.error('Error updating CRM lead:', error);
      return { success: false, error: error.message };
    }
    
    if (data) {
      revalidatePath('/crm'); // Revalidate the CRM page
      return { success: true, data: data as CrmLead, message: 'Lead updated successfully.' };
    }
    return { success: false, error: 'Failed to update lead or retrieve updated data.' };

  } catch (e: any) {
    console.error('Exception in updateCrmLeadAction:', e);
    return { success: false, error: e.message || 'An unexpected error occurred.' };
  }
}

// Action to DELETE a CRM lead
export async function deleteCrmLeadAction(leadId: number): Promise<ServerActionResponse<null>> {
  const supabase = await createClient();
  console.log('Server Action deleteCrmLeadAction called for ID:', leadId);

  if (!leadId) {
    return { success: false, error: 'Lead ID is required for deletion.' };
  }

  try {
    const { error } = await supabase
      .from('crm_leads')
      .delete()
      .eq('id', leadId);

    if (error) {
      console.error('Error deleting CRM lead:', error);
      return { success: false, error: error.message };
    }

    revalidatePath('/crm'); // Revalidate the CRM page
    return { success: true, message: 'Lead deleted successfully.' };

  } catch (e: any) {
    console.error('Exception in deleteCrmLeadAction:', e);
    return { success: false, error: e.message || 'An unexpected error occurred.' };
  }
}
