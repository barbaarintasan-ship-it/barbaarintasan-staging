// Google Calendar Integration for creating Google Meet links
import { google } from 'googleapis';

async function getAccessToken() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    console.error('[Google Calendar] X_REPLIT_TOKEN not found');
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  console.log('[Google Calendar] Fetching fresh connection settings...');
  
  const response = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-calendar',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  );
  
  const data = await response.json();
  const connectionSettings = data.items?.[0];

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings?.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    console.error('[Google Calendar] Not connected or no access token');
    throw new Error('Google Calendar not connected');
  }
  
  console.log('[Google Calendar] Successfully got access token');
  return accessToken;
}

async function getUncachableGoogleCalendarClient() {
  const accessToken = await getAccessToken();

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.calendar({ version: 'v3', auth: oauth2Client });
}

export async function createGoogleMeetLink(title: string, description: string, startDateTime: string, durationMinutes: number = 60): Promise<{ meetLink: string; eventId: string }> {
  const calendar = await getUncachableGoogleCalendarClient();
  
  const startDate = new Date(startDateTime);
  const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);

  const event = {
    summary: title,
    description: description,
    start: {
      dateTime: startDate.toISOString(),
      timeZone: 'Africa/Mogadishu',
    },
    end: {
      dateTime: endDate.toISOString(),
      timeZone: 'Africa/Mogadishu',
    },
    conferenceData: {
      createRequest: {
        requestId: `barbaarintasan-${Date.now()}`,
        conferenceSolutionKey: {
          type: 'hangoutsMeet'
        }
      }
    },
  };

  const response = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: event,
    conferenceDataVersion: 1,
  });

  const meetLink = response.data.conferenceData?.entryPoints?.find(
    (ep: any) => ep.entryPointType === 'video'
  )?.uri || '';

  return {
    meetLink,
    eventId: response.data.id || '',
  };
}
