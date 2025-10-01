# Manual Testing Checklist for Pocket Prompt Encryption Features

## Prerequisites

Before starting manual tests, ensure you have:

- [ ] ArConnect browser extension installed
- [ ] An Arweave wallet with some test AR tokens
- [ ] The application running locally (`bun dev`)
- [ ] Browser DevTools open (Console tab) for debugging

## Test Environment Setup

1. Open the application in your browser
2. Open DevTools Console (F12 or Cmd+Option+I)
3. Clear localStorage: `localStorage.clear()`
4. Refresh the page

---

## 1. Wallet Connection & Permissions

### Test: Initial Wallet Connection

**Steps:**
1. Click "Connect Wallet" button
2. ArConnect popup should appear
3. Check requested permissions list

**Expected Result:**
- [ ] ArConnect requests standard permissions: ACCESS_ADDRESS, SIGN_TRANSACTION
- [ ] ArConnect requests new permissions: ENCRYPT, DECRYPT
- [ ] All permissions are clearly listed
- [ ] Wallet connects successfully
- [ ] User address displays in UI

**Notes:**
_Record any permission issues or errors here_

---

## 2. Encryption on Upload

### Test: Upload Prompt WITHOUT "public" Tag (Should Encrypt)

**Steps:**
1. Create new prompt with title "Private Test Prompt"
2. Add content: "This is private content that should be encrypted"
3. Add tags: `work`, `draft` (NO "public" tag)
4. Click "Upload to Arweave"
5. Wait for transaction confirmation
6. Check console for logs

**Expected Result:**
- [ ] Console shows: Encryption started
- [ ] No errors in console
- [ ] Transaction successfully uploaded
- [ ] Prompt appears in list with lock icon 🔒
- [ ] Transaction ID is displayed

**Verify on Arweave:**
1. Copy transaction ID
2. Go to ViewBlock: `https://viewblock.io/arweave/tx/{TX_ID}`
3. Check transaction data

**Expected on ViewBlock:**
- [ ] Content is encrypted (not readable plain text)
- [ ] Tags include: `Pocket-Prompt-v2`, `Content-Type: application/json`
- [ ] Data structure shows `encryptedContent`, `encryptedKey`, `iv`, `isEncrypted: true`

**Note:** Protocol v2 uses session-based encryption - you'll only sign once per session!

---

### Test: Upload Prompt WITH "public" Tag (Should NOT Encrypt)

**Steps:**
1. Create new prompt with title "Public Test Prompt"
2. Add content: "This is public content"
3. Add tags: `public`, `tutorial`
4. Click "Upload to Arweave"
5. Wait for transaction confirmation

**Expected Result:**
- [ ] Console shows: Upload started (no encryption mention)
- [ ] Transaction successfully uploaded
- [ ] Prompt appears in list with globe icon 🌐
- [ ] Transaction ID is displayed

**Verify on ViewBlock:**
1. Copy transaction ID
2. Check transaction data

**Expected on ViewBlock:**
- [ ] Content is readable plain text (not encrypted)
- [ ] Content matches what you typed
- [ ] Tags include `public` tag

---

### Test: Case-Insensitive "public" Tag

**Test these variants:**
- [ ] `PUBLIC` → Should NOT encrypt
- [ ] `Public` → Should NOT encrypt
- [ ] `PuBLiC` → Should NOT encrypt
- [ ] `publicize` → Should encrypt (not exact match)

---

## 3. Decryption on Fetch

### Test: Fetch and Decrypt Private Prompt

**Steps:**
1. Reload the page (clears cache)
2. Connect wallet
3. Click "Sync from Arweave" or wait for auto-sync
4. Find the encrypted prompt you created earlier
5. Click to view/edit the prompt

**Expected Result:**
- [ ] Prompt loads successfully
- [ ] Content is decrypted and readable
- [ ] Content matches original text
- [ ] Lock icon 🔒 displays next to title
- [ ] No decryption errors in console

**Troubleshooting:**
If decryption fails:
- Check console for detailed error messages
- Verify wallet is connected
- Confirm DECRYPT permission was granted

---

### Test: Fetch Public Prompt

**Steps:**
1. Find the public prompt you created
2. Click to view/edit

**Expected Result:**
- [ ] Prompt loads successfully
- [ ] Content is readable (no decryption needed)
- [ ] Globe icon 🌐 displays next to title
- [ ] Loads faster than encrypted prompts

---

## 4. Visual Indicators

### Test: Icon Display

**Check icon display for:**
- [ ] Encrypted prompt shows lock icon 🔒
- [ ] Public prompt shows globe icon 🌐
- [ ] Icons appear in prompt list
- [ ] Icons appear in prompt detail view
- [ ] Icons are properly sized and aligned

---

### Test: Archive Icon Highlighting

**Steps:**
1. Create or select a prompt
2. Archive the prompt (click archive button)
3. Navigate to "Archive" view

**Expected Result:**
- [ ] Archived prompt appears in archive list
- [ ] Archive icon is highlighted/active
- [ ] Prompt maintains encryption status (lock or globe icon)

---

## 5. Upload Modal & Drag-and-Drop

### Test: Drag-and-Drop Upload

**Steps:**
1. Click "Upload" button to open modal
2. Drag a `.md` markdown file onto the drop zone
3. Verify file preview appears

**Expected Result:**
- [ ] Drop zone highlights on drag-over
- [ ] File preview shows:
  - Filename
  - Parsed title from frontmatter or filename
  - Parsed tags
  - Content preview
- [ ] Preview is readable and formatted

---

### Test: Batch Upload with Mixed Public/Private

**Steps:**
1. Create 2 markdown files:
   - `private.md` with tags: `work, draft`
   - `public.md` with tags: `public, tutorial`
2. Drag both files to upload modal
3. Review preview of both

**Expected Result:**
- [ ] Both files show in preview
- [ ] Public file marked as "will be public"
- [ ] Private file marked as "will be encrypted"
- [ ] Can remove individual files from batch
- [ ] Upload processes both correctly

---

### Test: Upload Modal Error Handling

**Test these error scenarios:**
1. [ ] Drag non-markdown file → Shows error message
2. [ ] Drag file with no content → Shows warning
3. [ ] Upload while wallet disconnected → Shows connection prompt

---

## 6. Backward Compatibility

### Test: Load Existing Unencrypted Prompts

**Prerequisites:**
- Must have prompts created before encryption feature was added

**Steps:**
1. Connect wallet
2. Sync from Arweave
3. View old prompts

**Expected Result:**
- [ ] Old prompts load successfully
- [ ] Content displays correctly (treated as public/unencrypted)
- [ ] No decryption errors
- [ ] Can still edit and re-upload

---

## 7. Error Handling & Edge Cases

### Test: Wallet Disconnected During Encryption

**Steps:**
1. Start creating encrypted prompt
2. Disconnect wallet BEFORE clicking upload
3. Try to upload

**Expected Result:**
- [ ] Clear error message: "Wallet not connected"
- [ ] Prompt to reconnect wallet
- [ ] No data loss (can retry after reconnecting)

---

### Test: Missing DECRYPT Permission

**Steps:**
1. Connect wallet with only standard permissions (deny DECRYPT)
2. Try to view encrypted prompt

**Expected Result:**
- [ ] Clear error message about missing permission
- [ ] Option to request permission
- [ ] Graceful fallback (doesn't crash app)

---

### Test: Invalid/Corrupted Encrypted Data

**This is tested in unit tests, but verify:**
- [ ] App doesn't crash on invalid data
- [ ] Shows user-friendly error message
- [ ] Can still access other prompts

---

## 8. Performance & UX

### Test: Encryption Speed

**Steps:**
1. Create prompt with 10KB of content
2. Add tags (no "public")
3. Click upload and time the process

**Expected Result:**
- [ ] Encryption completes in < 2 seconds
- [ ] No UI freezing or lag
- [ ] Progress indicator visible
- [ ] Clear feedback when complete

---

### Test: Decryption Speed

**Steps:**
1. Open prompt with ~10KB encrypted content
2. Time from click to content display

**Expected Result:**
- [ ] Decryption completes in < 1 second
- [ ] No UI freezing
- [ ] Content renders smoothly

---

## 9. Cross-Browser Testing

Test the above scenarios in:
- [ ] Chrome/Chromium
- [ ] Firefox
- [ ] Safari (if supported by ArConnect)
- [ ] Brave

**Note browser-specific issues:**
_Record any differences in behavior_

---

## 10. Security Verification

### Test: Encrypted Data is Truly Encrypted

**Steps:**
1. Upload encrypted prompt
2. Copy transaction ID
3. Use Arweave GraphQL to fetch raw data:
   ```graphql
   query {
     transaction(id: "TX_ID") {
       data
     }
   }
   ```

**Expected Result:**
- [ ] Raw data is base64 encoded
- [ ] Decoded data shows encrypted structure (not plain text)
- [ ] Cannot read content without wallet private key

---

### Test: Different Wallets Cannot Decrypt Each Other's Content

**Prerequisites:**
- 2 different Arweave wallets

**Steps:**
1. Wallet A: Create encrypted prompt
2. Wallet B: Try to decrypt Wallet A's prompt

**Expected Result:**
- [ ] Decryption fails with clear error
- [ ] No private data leaked
- [ ] App handles gracefully

---

## Test Summary

### Pass/Fail Counts
- Tests Passed: ___
- Tests Failed: ___
- Tests Blocked: ___
- Tests Skipped: ___

### Critical Issues Found
_List any blocking issues_

### Minor Issues Found
_List any non-blocking issues_

### Browser Compatibility
_Note any browser-specific behavior_

### Performance Notes
_Record any performance concerns_

---

## Sign-Off

**Tester Name:** ___________________
**Date:** ___________________
**Build/Commit:** ___________________
**Overall Status:** [ ] PASS / [ ] FAIL / [ ] PASS WITH ISSUES
