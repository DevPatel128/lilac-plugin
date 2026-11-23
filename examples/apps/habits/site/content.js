// Static copy: FAQ, tour steps. Every answer describes what the app actually does.
export const FAQ = [
  ['Where is my data stored?', 'Only in this browser, in local storage for this site. There is no server and no account, so nothing leaves your device and nobody else can read it from here.'],
  ['How do I back up my habits?', 'Open Settings and press Export JSON. You get a small file with your habits and settings. Keep it somewhere safe. To restore it, press Import JSON in Settings and choose the file.'],
  ['How are streaks counted?', 'A streak is the number of days in a row you ticked a habit. If you have not ticked today yet, the streak that ended yesterday still counts, so you have until midnight to keep it. One missed day resets it to zero. Insights also shows weeks on target: weeks in a row where you reached your weekly target.'],
  ['How is weekly progress counted?', 'Each habit has a weekly target of 1 to 7 days. The week starts on Monday unless you change it in Settings. Progress for the week is the days ticked out of the target. Extra days over the target do not raise the weekly percentage.'],
  ['Does it work offline?', 'Yes. After the first visit the browser keeps a copy of the app files, so you can reload and use it with no connection. When a new version is available a bar appears at the top with a Reload to update button.'],
  ['What are the keyboard shortcuts?', 'On the Today screen: n adds a habit, j and k move between habits, Space ticks or unticks today, / searches, u undoes a delete and ? lists them all. Shortcuts never fire while you are typing in a field.'],
  ['Can I install it as an app?', 'Yes, in browsers that support it. Look for an install icon in the address bar or choose Install or Add to Home Screen in the browser menu. It then opens in its own window and works offline.'],
  ['What is not collected?', 'No name, email, location, analytics, cookies, advertising identifiers or crash reports. The app makes no requests to other sites. The Support screen copies text to your clipboard only when you press a button.'],
  ['How do I delete everything?', 'Open Settings and press Reset all data, then confirm. All habits and settings in this browser are erased. Export first if you may want them back. Clearing this site\'s data in your browser settings does the same.'],
  ['I deleted a habit by mistake. Can I get it back?', 'Right after deleting, a message appears with an Undo button, and the u key does the same. It stays for about ten seconds. After that, import a backup file if you have one.'],
  ['What if the browser says storage is full or blocked?', 'The app shows a warning that your latest change could not be saved. Export your data from Settings straight away, then free space or allow site storage and import the file again.'],
  ['What happens if I import a bad file?', 'The file is checked first. A file that is not valid JSON, is too large (over 256 KB), has the wrong shape or contains unsafe keys is rejected with a message and nothing changes. A good file asks for confirmation before it replaces your habits.'],
];
export const TOUR = [
  ['Welcome', 'Pocket Habits is a small, private tracker. It is a fictional sample: everything stays in this browser and nothing is sent anywhere.'],
  ['Add a habit', 'Press New habit (or the n key). Give it a name, a weekly target and a colour.'],
  ['Tick the days', 'Each habit shows the last 7 days. Press a day to tick or untick it. Streaks and weekly progress update straight away.'],
  ['See the big picture', 'Insights shows the last four weeks as bars and the last eight weeks as a day-by-day grid, with the same numbers in text.'],
  ['Keep a backup', 'Settings lets you export your habits as a file and import them again. That file is your only backup, so export now and then.'],
];
