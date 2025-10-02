# Encryption UI Guide

## Overview

The Pocket Prompt UI now provides **clear, prominent encryption feedback** to users at every step of creating and viewing prompts.

---

## What Changed

### ✅ Before (No UI)
- ❌ No mention of encryption anywhere
- ❌ No explanation of "public" tag behavior
- ❌ Users didn't know prompts were encrypted by default
- ❌ No visual indicator of encryption status

### ✅ After (Complete UI)
- ✅ **Prominent encryption status badge** in editor header
- ✅ **Informational banner** explaining what will happen
- ✅ **Quick toggle button** to make public/private
- ✅ **Visual tag highlighting** for "public" tag
- ✅ **Real-time updates** as tags change
- ✅ **Clear labels** in view mode

---

## UI Components Added

### 1. PromptEditor (Create/Edit Mode)

#### A. Encryption Status Badge (Top Right)
```
┌─────────────────────────────────────────────────┐
│ Create New Prompt              [🔒 Encrypted]   │
│ Create a new prompt and upload...               │
└─────────────────────────────────────────────────┘
```

**Features:**
- Shows `🔒 Encrypted` (blue badge) by default
- Changes to `🌐 Public` (gray badge) when "public" tag added
- Updates in real-time as tags change

#### B. Encryption Info Banner
```
┌─────────────────────────────────────────────────┐
│ 🛡️ This prompt will be encrypted before upload │
│                                                  │
│ Only your wallet can decrypt this content. By   │
│ default, all prompts are encrypted using your   │
│ Arweave wallet's public key. To make a prompt   │
│ public, add the `public` tag.                   │
└─────────────────────────────────────────────────┘
```

**Two States:**

**State 1: Encrypted (Blue border, blue background)**
- Icon: 🛡️ Shield
- Title: "This prompt will be encrypted before upload"
- Description: Explains wallet encryption + how to make public

**State 2: Public (Gray border, gray background)**
- Icon: ℹ️ Info
- Title: "This prompt will be publicly readable"
- Description: Warns content is plain text + how to encrypt

#### C. Quick Public/Private Toggle
```
┌──────────────────────────────────────┐
│ Tags            [🌐 Make Public]     │
│                                      │
│ [                           ] [Add]  │
└──────────────────────────────────────┘
```

**Features:**
- Button text changes based on current state
- `🌐 Make Public` when encrypted (adds "public" tag)
- `🔒 Make Private` when public (removes "public" tag)
- Single-click toggle, no typing needed

#### D. Visual Tag Highlighting
```
Tags:
[work] [draft] [🌐 public]
  ↑      ↑         ↑
 Gray   Gray      Blue + Globe Icon
```

**Features:**
- "public" tag highlighted in blue
- Shows globe icon 🌐 next to "public"
- Tooltip: "This tag makes the prompt public (click to remove)"
- All other tags: gray with no icon

---

### 2. PromptDialog (View Mode)

#### Encryption Status Badge (Next to Title)
```
┌────────────────────────────────────────┐
│ My Secret Recipe    [🔒 Encrypted]     │
│ Top secret instructions                │
└────────────────────────────────────────┘
```

**Features:**
- Blue badge with lock icon for encrypted
- Gray badge with globe icon for public
- Tooltip on hover with explanation
- Non-interactive (view only)

---

## User Flow Examples

### Example 1: Creating an Encrypted Prompt (Default)

**Step 1: Open editor**
```
┌──────────────────────────────────────────┐
│ Create New Prompt      [🔒 Encrypted]    │
│                                           │
│ 🛡️ This prompt will be encrypted...      │
│ Only your wallet can decrypt...           │
└──────────────────────────────────────────┘
```
✅ User immediately sees: "Will be encrypted by default"

**Step 2: Fill in content**
```
Title: My API Keys
Content: sk-prod-abc123...
Tags: [work]
```
✅ Encryption status stays: `🔒 Encrypted`

**Step 3: Click "Create & Upload"**
- Content is encrypted ✅
- Uploads to Arweave with encryption
- User sees lock icon in list

---

### Example 2: Creating a Public Prompt

**Option A: Using the Toggle Button**

**Step 1: Click "Make Public" button**
```
Before:                After:
[🌐 Make Public]  →   [🔒 Make Private]
```
✅ Status updates automatically

**Step 2: Confirmation dialog appears**
```
⚠️ WARNING: Making this prompt public will store it as
plain text on Arweave PERMANENTLY.

• Anyone can read it forever
• It cannot be deleted from Arweave
• Making it private later will NOT remove the public version

Are you sure you want to make this prompt public?
```
✅ User must confirm before making public

**Step 3: Banner changes (after confirmation)**
```
⚠ Warning: This prompt will be stored as plain text on
Arweave and will be permanently public...
```
✅ Clear warning about PERMANENT public visibility

**Step 3: Tags update**
```
Tags: [🌐 public]
```
✅ "public" tag auto-added and highlighted

---

**Option B: Manually Adding "public" Tag**

**Step 1: Type "public" in tag field**
```
[public              ] [Add]
```

**Step 2: Click "Add" or press Enter**
- Tag added: `[🌐 public]`
- Status badge updates: `🌐 Public`
- Banner changes to warning
- Toggle button updates: `🔒 Make Private`

✅ All UI elements update in sync

---

### Example 3: Switching Between Public/Private

**Start: Public prompt**
```
Status: [🌐 Public]
Tags: [tutorial] [🌐 public] [guide]
Banner: ℹ️ This prompt will be publicly readable
```

**Action: Click "Make Private" button**

**Result: Encrypted prompt**
```
Status: [🔒 Encrypted]
Tags: [tutorial] [guide]  ← "public" removed
Banner: 🛡️ This prompt will be encrypted...
```

✅ Seamless toggle with instant feedback

---

### Example 4: Removing "public" Tag Manually

**Start:**
```
Tags: [work] [🌐 public] [notes]
```

**Action: Click X on "public" tag**

**Result:**
- Tag removed from list
- Status badge: `🌐 Public` → `🔒 Encrypted`
- Banner: Warning → Encryption info
- Toggle button: Updates to "Make Public"

✅ All UI stays synchronized

---

## Visual Design Specifications

### Color Scheme

#### Encrypted State (Default)
```css
Badge: Blue background (#3b82f6)
Banner: Blue border + light blue bg
Icon: Shield (blue)
```

#### Public State (Warning)
```css
Badge: Gray background (muted)
Banner: Yellow border + light yellow bg (⚠️ warning color)
Icon: Warning triangle (yellow)
Text: Yellow-700 (dark) / Yellow-300 (light mode)
```

### Icons Used

| State | Icon | Meaning |
|-------|------|---------|
| Encrypted | 🔒 Lock | Content is encrypted |
| Public | 🌐 Globe | Content is public |
| Info | 🛡️ Shield | Encryption protection active |
| Warning | ℹ️ Info | Public visibility warning |

### Badge Variants

```tsx
// Encrypted
<Badge variant="default" className="...">
  <Lock /> Encrypted
</Badge>

// Public
<Badge variant="secondary" className="...">
  <Globe /> Public
</Badge>
```

---

## Accessibility Features

### Screen Reader Support
- All icons have `aria-label` attributes
- Status badge has descriptive `title` tooltip
- Toggle button has `title` explaining action

### Keyboard Navigation
- Tab to toggle button
- Enter/Space to activate
- Tab to tag input
- Enter to add tag
- Click or Enter on tags to remove

### Visual Indicators
- Color is never the only indicator
- Icons supplement color coding
- Text labels always present
- Tooltips provide extra context

---

## User Education Messages

### Default (Encrypted) Message
```
Only your wallet can decrypt this content. By default,
all prompts are encrypted using your Arweave wallet's
public key. To make a prompt public, add the `public` tag.
```

**Key Points:**
- ✅ States the default behavior (encrypted)
- ✅ Explains who can decrypt (only your wallet)
- ✅ Shows how to change (add "public" tag)

### Public Warning Message
```
⚠ Warning: This prompt will be stored as plain text on Arweave
and will be permanently public. Anyone can read it forever. Making
it private later will only encrypt future uploads—the public
version will remain on Arweave permanently.
```

**Key Points:**
- ⚠️ Warns about PERMANENT public visibility
- ⚠️ Clarifies data is plain text on blockchain forever
- ⚠️ Explains that making it private later won't delete the public version
- ✅ States that future uploads will be encrypted if made private

---

## Testing the UI

### Manual Test Cases

#### Test 1: Default Encryption State
1. Open editor (new prompt)
2. ✅ Should see: `[🔒 Encrypted]` badge
3. ✅ Should see: Blue encryption banner
4. ✅ Toggle button: "Make Public"

#### Test 2: Toggle to Public
1. Click "Make Public" button
2. ✅ Confirmation dialog appears with permanent storage warning
3. Click "OK" to confirm
4. ✅ Badge changes to: `[🌐 Public]`
5. ✅ Banner changes to yellow warning (permanent storage notice)
6. ✅ "public" tag added and highlighted
7. ✅ Toggle button: "Make Private"

#### Test 3: Toggle Back to Encrypted
1. Click "Make Private" button
2. ✅ Badge changes to: `[🔒 Encrypted]`
3. ✅ Banner changes to blue info
4. ✅ "public" tag removed
5. ✅ Toggle button: "Make Public"

#### Test 4: Manual Tag Addition
1. Type "public" in tag input
2. Press Enter or click "Add"
3. ✅ Confirmation dialog appears with permanent storage warning
4. Click "OK" to confirm
5. ✅ All UI updates (same as toggle)

#### Test 4b: Cancel Public Tag Addition
1. Type "public" in tag input
2. Press Enter or click "Add"
3. Confirmation dialog appears
4. Click "Cancel"
5. ✅ Tag input is cleared
6. ✅ "public" tag is NOT added
7. ✅ Status remains `[🔒 Encrypted]`

#### Test 5: Manual Tag Removal
1. Add "public" tag (any method)
2. Click X on "public" badge
3. ✅ All UI updates (same as toggle)

#### Test 6: Case Insensitivity
1. Try adding: "PUBLIC", "Public", "pUbLiC"
2. ✅ All variations trigger public state
3. ✅ Banner and badge update
4. ✅ Tag displayed as typed (preserves case)

#### Test 7: View Mode
1. Create encrypted prompt
2. Open in view mode
3. ✅ See: `[🔒 Encrypted]` badge next to title
4. Hover over badge
5. ✅ Tooltip: "This prompt is encrypted..."

#### Test 8: Public Prompt in View Mode
1. Create public prompt (with "public" tag)
2. Open in view mode
3. ✅ See: `[🌐 Public]` badge next to title
4. Hover over badge
5. ✅ Tooltip: "This prompt is public..."

---

## Implementation Details

### Real-time Updates

The UI uses React state to update in real-time:

```typescript
// Recalculates whenever tags change
const willBeEncrypted = shouldEncrypt(tags);

// Badge updates automatically
<Badge variant={willBeEncrypted ? "default" : "secondary"}>
  {willBeEncrypted ? <Lock /> : <Globe />}
</Badge>
```

### Toggle Function

```typescript
const handleTogglePublic = () => {
  const hasPublicTag = tags.some(tag => tag.toLowerCase() === 'public');
  if (hasPublicTag) {
    // Remove "public" tag (case-insensitive)
    setTags(tags.filter(tag => tag.toLowerCase() !== 'public'));
  } else {
    // Add "public" tag
    setTags([...tags, 'public']);
  }
};
```

### Tag Highlighting

```typescript
{tags.map(tag => {
  const isPublicTag = tag.toLowerCase() === 'public';
  return (
    <Badge
      variant={isPublicTag ? "default" : "secondary"}
      // Globe icon only on "public" tag
      {isPublicTag && <Globe className="..." />}
      {tag}
    </Badge>
  );
})}
```

---

## Common User Questions (Answered by UI)

### Q: "Are my prompts private by default?"
**A:** ✅ Yes! The UI shows `🔒 Encrypted` badge and banner explaining default encryption.

### Q: "How do I make a prompt public?"
**A:** ✅ Banner text explicitly says: "To make a prompt public, add the `public` tag" + Toggle button makes it one-click.

### Q: "How do I know if this prompt is encrypted?"
**A:** ✅ Badge shows `🔒 Encrypted` or `🌐 Public` in both edit and view modes.

### Q: "What happens if I add the 'public' tag?"
**A:** ✅ Banner immediately changes to warning: "This prompt will be publicly readable... Anyone can read it."

### Q: "Can I switch between public and private?"
**A:** ✅ You can make a private prompt public, or a public prompt private. However, once a prompt is made public on Arweave, that version remains publicly accessible forever. Making it private only encrypts future uploads.

### Q: "I typed 'PUBLIC' in caps, will it work?"
**A:** ✅ Yes! Case-insensitive detection. UI updates regardless of capitalization.

---

## Safety Features

### Confirmation Dialog for Public Prompts

To prevent accidental public exposure of sensitive information, a confirmation dialog appears whenever a user attempts to make a prompt public:

**Triggers:**
- Clicking "Make Public" toggle button
- Manually adding "public" tag via tag input

**Dialog Content:**
```
⚠️ WARNING: Making this prompt public will store it as
plain text on Arweave PERMANENTLY.

• Anyone can read it forever
• It cannot be deleted from Arweave
• Making it private later will NOT remove the public version

Are you sure you want to make this prompt public?
```

**User Actions:**
- **Cancel**: No changes made, prompt remains encrypted
- **OK**: "public" tag is added, prompt becomes public

**No Confirmation Required:**
- Removing "public" tag (making private)
- Editing tags other than "public"
- Any other tag operations

This prevents accidental public exposure while allowing intentional sharing with explicit consent.

---

## Summary

### Before Enhancement
- Users had **zero visibility** into encryption
- No guidance on "public" tag behavior
- Manual tag typing required
- No feedback until after upload

### After Enhancement
- ✅ **Prominent encryption status** always visible
- ✅ **Educational banners** explain behavior
- ✅ **One-click toggle** for public/private
- ✅ **Real-time feedback** as you type
- ✅ **Visual tag highlighting** for "public"
- ✅ **Consistent UX** across create/edit/view modes

### User Experience Improvement
- **Confidence**: Users know exactly what will happen
- **Control**: Easy toggle between public/private
- **Education**: Clear explanations of encryption
- **Safety**: Prominent warnings for public prompts
- **Discoverability**: "public" tag behavior is obvious

---

## Future Enhancements (Optional)

### Possible Additions
1. **Encryption indicator on prompt cards** in list view
2. **Filter by encryption status** (show only encrypted/public)
3. **Bulk encryption toggle** for multiple prompts
4. **Encryption statistics** dashboard
5. **"Recently made public" warning** on edit
6. **Export encryption key** backup option

### Advanced Features
1. **Share encrypted prompt** with specific wallets
2. **Time-limited public links** (decrypt temporarily)
3. **Group encryption** (shared wallet access)
4. **Encryption strength selector** (AES-128 vs AES-256)

---

## Files Modified

1. **`src/components/PromptEditor.tsx`**
   - Added encryption status badge
   - Added info banner with explanations
   - Added quick toggle button
   - Added visual tag highlighting
   - Real-time updates based on tags

2. **`src/components/PromptDialog.tsx`**
   - Enhanced status badge with label
   - Added descriptive tooltip
   - Consistent styling with editor

3. **`src/lib/encryption.ts`** (already existed)
   - Imported `shouldEncrypt()` function
   - Used for real-time status calculation

---

## Conclusion

The encryption UI is now **comprehensive, clear, and user-friendly**. Users have:

✅ **Full visibility** into encryption status
✅ **Easy control** over public/private settings
✅ **Clear education** about how encryption works
✅ **Prominent warnings** when making prompts public
✅ **Real-time feedback** as they work

**No user will be confused about encryption anymore!** 🎉
