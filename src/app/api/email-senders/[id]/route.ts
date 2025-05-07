import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_URL');
}
if (!supabaseServiceRoleKey) {
  throw new Error('Missing env.SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// Zod schema for validating PUT request body (all fields optional for partial updates)
const updateSenderSchema = z.object({
  employee_name: z.string().min(1, { message: 'Employee name cannot be empty' }).optional(),
  employee_email: z.string().email({ message: 'Invalid email address' }).optional(),
  is_active: z.boolean().optional(),
});

export interface EmailSender {
  id: number;
  employee_name: string;
  employee_email: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * @swagger
 * /api/email-senders/{id}:
 *   put:
 *     summary: Update an existing email sender
 *     description: Updates details of a specific email sender by their ID.
 *     tags:
 *       - Email Senders
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Numeric ID of the email sender to update.
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               employee_name:
 *                 type: string
 *                 example: 'Johnathan Doe'
 *               employee_email:
 *                 type: string
 *                 format: email
 *                 example: 'johnathan.doe@example.com'
 *               is_active:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       200:
 *         description: Email sender updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EmailSender'
 *       400:
 *         description: Invalid request body or ID
 *       404:
 *         description: Email sender not found
 *       409:
 *         description: Conflict - Email address already exists for another sender
 *       500:
 *         description: Internal server error
 */
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const senderId = parseInt(params.id, 10);
    if (isNaN(senderId)) {
      return NextResponse.json({ error: 'Invalid sender ID format' }, { status: 400 });
    }

    const body = await req.json();
    const validation = updateSenderSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid request body', details: validation.error.flatten() }, { status: 400 });
    }

    const { employee_name, employee_email, is_active } = validation.data;

    // If email is being updated, check if the new email already exists for another sender
    if (employee_email) {
      const { data: existingSender, error: checkError } = await supabase
        .from('email_senders')
        .select('id')
        .eq('employee_email', employee_email)
        .neq('id', senderId) // Exclude the current sender from the check
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') { // PGRST116: Row not found, which is fine
        console.error('Error checking for conflicting email:', checkError);
        return NextResponse.json({ error: checkError.message }, { status: 500 });
      }
      if (existingSender) {
        return NextResponse.json({ error: 'Conflict: This email address is already in use by another sender.' }, { status: 409 });
      }
    }

    const updateData: Partial<Omit<EmailSender, 'id' | 'created_at' | 'updated_at'>> = {};
    if (employee_name !== undefined) updateData.employee_name = employee_name;
    if (employee_email !== undefined) updateData.employee_email = employee_email;
    if (is_active !== undefined) updateData.is_active = is_active;

    if (Object.keys(updateData).length === 0) {
        return NextResponse.json({ error: 'No update fields provided' }, { status: 400 });
    }
    
    // Supabase typically handles updated_at via database triggers or policies.
    // If not, you might need to set it manually: updateData.updated_at = new Date().toISOString();

    const { data: updatedSender, error: updateError } = await supabase
      .from('email_senders')
      .update(updateData)
      .eq('id', senderId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating email sender:', updateError);
      // PGRST116 can also mean 'no rows found' for update if .single() expects one row modified.
      if (updateError.code === 'PGRST116' || updateError.code === 'PGRST204') { 
        // Check if the sender actually exists before concluding 'not found'
        const { data: exists, error: existenceError } = await supabase.from('email_senders').select('id').eq('id', senderId).maybeSingle();
        if (existenceError) {
            console.error('Error checking sender existence:', existenceError);
            return NextResponse.json({ error: 'Error confirming sender status after update attempt.' }, { status: 500 });
        }
        if (!exists) {
            return NextResponse.json({ error: 'Email sender not found.' }, { status: 404 });
        }
        // If it exists but no change was made (e.g. same data sent), Supabase might return no rows.
        // Re-fetch the sender to return current state if no error but no data returned by update.
        const { data: currentSenderData, error: currentSenderError } = await supabase
            .from('email_senders')
            .select('*')
            .eq('id', senderId)
            .single();
        if (currentSenderError) {
             return NextResponse.json({ error: 'Failed to retrieve sender after update (no changes made).' }, { status: 500 });
        }
        return NextResponse.json(currentSenderData as EmailSender, { status: 200 });
      }
      if (updateError.code === '23505') { // unique_violation (should be caught by the email check above, but as a fallback)
        return NextResponse.json({ error: 'Conflict: Email address already exists.' }, { status: 409 });
      }
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    if (!updatedSender) {
        // This case might be redundant due to the error handling above but kept for safety.
        return NextResponse.json({ error: 'Email sender not found or no changes made after update attempt.' }, { status: 404 });
    }

    return NextResponse.json(updatedSender as EmailSender, { status: 200 });
  } catch (err: any) {
    console.error('Unexpected error in PUT /api/email-senders/[id]:', err);
    if (err instanceof SyntaxError && err.message.includes('JSON')) {
        return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }
    return NextResponse.json({ error: err.message || 'An unexpected error occurred' }, { status: 500 });
  }
}

/**
 * @swagger
 * /api/email-senders/{id}:
 *   delete:
 *     summary: Delete an email sender
 *     description: Removes a specific email sender by their ID.
 *     tags:
 *       - Email Senders
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Numeric ID of the email sender to delete.
 *         schema:
 *           type: integer
 *     responses:
 *       204:
 *         description: Email sender deleted successfully (No Content).
 *       400:
 *         description: Invalid ID format
 *       404:
 *         description: Email sender not found
 *       500:
 *         description: Internal server error
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const senderId = parseInt(params.id, 10);
    if (isNaN(senderId)) {
      return NextResponse.json({ error: 'Invalid sender ID format' }, { status: 400 });
    }

    // First, check if the sender exists to provide a 404 if not.
    const { data: existingSender, error: checkError } = await supabase
        .from('email_senders')
        .select('id')
        .eq('id', senderId)
        .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 means no rows found, which is handled next.
        console.error('Error checking sender existence before delete:', checkError);
        return NextResponse.json({ error: 'Error verifying sender before deletion.' }, { status: 500 });
    }

    if (!existingSender) {
        return NextResponse.json({ error: 'Email sender not found.' }, { status: 404 });
    }

    // If sender exists, proceed with deletion.
    const { error: deleteError } = await supabase
      .from('email_senders')
      .delete()
      .eq('id', senderId);

    if (deleteError) {
      console.error('Error deleting email sender:', deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return new NextResponse(null, { status: 204 }); // Successfully deleted, no content to return

  } catch (err: any) {
    console.error('Unexpected error in DELETE /api/email-senders/[id]:', err);
    return NextResponse.json({ error: err.message || 'An unexpected error occurred' }, { status: 500 });
  }
}