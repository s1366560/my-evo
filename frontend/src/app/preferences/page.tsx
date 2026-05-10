// Redirect /preferences to /account
import { redirect } from 'next/navigation';

export default function PreferencesPage() {
  redirect('/account');
}
