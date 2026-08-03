import { NextRequest } from 'next/server';
import { scanDriveFiles, generateSuggestions } from '@/lib/drive';
import { validateBody, driveSuggestionsSchema } from '@/lib/validations';
import { ok, err, validationErr } from '@/lib/api-response';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { data, error } = validateBody(driveSuggestionsSchema, body);
    if (error) {
      return validationErr(error.message);
    }
    const { accountId } = data;

    const { files, stats } = await scanDriveFiles(accountId);
    const suggestions = generateSuggestions(files, stats);

    const totalPotentialSavings = suggestions.reduce((s, sug) => s + sug.potentialSavings, 0);

    return ok({ suggestions, totalPotentialSavings });
  } catch (error: unknown) {
    console.error('Suggestions error:', error);
    return err('Operation failed. Please try again.');
  }
}
