<!-- Pocket Habits demo app (FICTIONAL SAMPLE): every control and what it must do. Results live in BUILD-LOG.md under "End-to-end user test". -->
# Controls test list

Rule: every button, link, tab, toggle, menu item and shortcut below does something real and visible. No `#` placeholder links, no permanently disabled buttons. All screens are reachable from the main nav (Today, Insights, Settings, Help, Support, About). There are no accounts: the app has no sign-in, and the test user is a file imported through Settings.

Test data: `tests/fixtures/test-user.json` (regenerate for today with `node tests/fixtures/make-test-user.mjs`).

| Screen | Control | Expected |
|---|---|---|
| All | Skip to content | Focus moves to main content; screen stays the same |
| All | Brand link | Goes to Today |
| All | Nav: Today, Insights, Settings, Help, Support, About | Shows that screen, sets `aria-current`, updates title, focuses the heading |
| All | Update bar "Reload to update" | Shown only when a new service worker waits; tells it to take over and reloads |
| All | Footer "Keyboard shortcuts" | Opens the shortcuts dialog; focus returns on close |
| Today | Take the tour (banner while the tour is not done, empty state once it is done or dismissed, Help, Settings onboarding) | Opens the 5-step dialog |
| Today | Not now (banner) | Hides the banner and remembers it |
| Today | Add your first habit | Opens New habit dialog |
| Today | Add 3 sample habits | Adds three invented habits with a few ticked days |
| Today | Search habits | Filters the list as you type |
| Today | Show (all, not done, done) | Filters by today's state |
| Today | Sort by (order, name, streak, target) | Reorders the list |
| Today | Clear search and filter | Resets both, focuses search |
| Today | New habit | Opens New habit dialog |
| Today | Day button (7 per habit) | Toggles that day, updates streak, week count, summary and announces it |
| Today | Edit | Opens the dialog filled in; Save changes updates the habit |
| Today | Delete | Removes the habit and shows a toast with Undo |
| Today | Toast Undo / OK | Undo restores the habit in its place; OK dismisses a message |
| Habit dialog | Name, target, colour | Validated; errors shown inline and focus goes to the first one |
| Habit dialog | Add habit / Save changes / Cancel | Saves and focuses the habit / saves / closes with no change |
| Tour dialog | Next, Back, Skip tour, Done | Moves between steps (Back hidden on step 1); Skip and Done close and remember |
| Shortcuts dialog | Close | Closes, focus returns |
| Insights | Show as table (2) | Expands a text version of the chart |
| Insights | Go to Today (empty state) | Goes to Today |
| Settings | Theme (3 radios) | Applies at once, saved |
| Settings | Week starts on (2 radios) | Weekly numbers and charts change at once, saved |
| Settings | Motion (2 radios) | "Always off" stops animation at once, saved |
| Settings | Export JSON | Downloads `pocket-habits-YYYY-MM-DD.json`, says how many habits |
| Settings | Import JSON | Opens the file picker; a bad file shows a clear error and changes nothing; a good file asks to confirm |
| Confirm dialog | Replace / Erase everything / Cancel | Does the action / does the action / closes with no change |
| Settings | Show onboarding again | Opens the tour |
| Settings | Reset all data | Confirm, then erases habits and settings and shows the empty state |
| Help | 12 FAQ buttons | Each toggles its answer, `aria-expanded` follows, Enter and Space work |
| Help | Keyboard shortcuts / Take the tour | Open the dialogs |
| Support | Write an email | `mailto:support@example.test` with subject and a body of app version and browser name only |
| Support | Copy support email | Copies the address, shows "Copied" |
| Support | Copy diagnostics | Copies version, schema version, habit count (never names), shows "Copied" |
| About | Settings link | Goes to Settings |
| Keyboard | n | New habit dialog |
| Keyboard | j / k | Moves between habits, announces |
| Keyboard | Space | Ticks or unticks today for the selected habit |
| Keyboard | / | Focuses search |
| Keyboard | u | Undoes the last delete |
| Keyboard | ? | Shortcuts dialog |
| Keyboard | Esc | Closes a dialog or dismisses a toast |
