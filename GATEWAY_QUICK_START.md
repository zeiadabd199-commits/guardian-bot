# GATEWAY VERIFICATION SYSTEM - QUICK START GUIDE

## For Server Administrators

### Initial Setup
1. **Enable Gateway**
   ```
   /gateway enable [#channel]
   ```
   Enables the verification system in a specific channel

2. **Set Verification Mode**
   ```
   /gateway mode set [trigger|button|reaction|slash]
   ```
   - `trigger` - Users type a keyword to verify
   - `button` - Users click a button to verify
   - `reaction` - Users react with an emoji to verify
   - `slash` - Users use /verify command

3. **Set Verified Role**
   ```
   /gateway role set_verify [@role]
   ```
   This role is granted after successful verification

4. **Configure Logging**
   ```
   /gateway logs enable [#channel]
   ```
   All verification attempts are logged here

### Advanced Configuration

**Security Settings**
```
/gateway security set minAccountAgeDays 3
/gateway security set minJoinMinutes 5
/gateway security set rateLimitPerMinute 3
```

**Embed Customization**
```
/gateway embed edit public title "Welcome!"
/gateway embed edit public description "Verify to gain access"
/gateway embed edit public color "#0099FF"
/gateway embed preview public
```

**Auto-Roles for New Members**
```
/gateway role set_verify @MemberRole
```

**Add Bypass Roles** (staff can skip verification)
```
/gateway role bypass_add @Admin
/gateway role bypass_add @Moderator
```

### Monitoring

**View Configuration**
```
/gateway view
```

**Check Statistics**
```
/gateway stats
```

**Manual Lock/Unlock**
```
/gateway lock lock 30 "Raid detected"
/gateway lock unlock
```

---

## For Users

### Slash Verification
If your server uses `/verify` mode:
```
/verify
```
**That's it!** You'll be verified if you meet the security requirements.

### Trigger Word Verification
If your server uses trigger word mode (e.g., "verify"):
- Go to the verification channel
- Type the verification word
- You'll be verified if you meet the requirements

### Button Verification
If your server uses button mode:
- Look for the verification message with a button
- Click the button
- You'll be verified if you meet the requirements

### Reaction Verification
If your server uses reaction mode:
- Find the verification message
- React with the specified emoji
- You'll be verified if you meet the requirements

---

## Messages You Might See

✅ **"Verification processed"** - You successfully verified!

❌ **"Account too new"** - Your account is too new. Wait and try again later.

❌ **"Joined too recently"** - You joined too recently. Wait and try again.

⚠️ **"Rate limited"** - You're trying too many times. Wait a minute and try again.

🔒 **"Gateway locked"** - The verification is temporarily locked due to suspicious activity.

---

## Commands Reference

### Admin Commands (Require Administrator)
```
/gateway enable          - Enable gateway verification
/gateway disable         - Disable gateway verification
/gateway view            - View current configuration
/gateway stats           - View verification statistics
/gateway mode set        - Set verification mode
/gateway security set    - Adjust security parameters
/gateway role set_verify - Set verified role
/gateway role bypass_add - Add bypass role
/gateway role bypass_remove - Remove bypass role
/gateway logs enable     - Enable verification logs
/gateway logs disable    - Disable verification logs
/gateway message set     - Set verification message
/gateway embed edit      - Customize embed appearance
/gateway embed preview   - Preview embed before saving
/gateway lock lock       - Manually lock gateway
/gateway lock unlock     - Manually unlock gateway
```

### User Commands
```
/verify                  - Manual verification (if slash mode enabled)
```

---

## Template Variables

When setting messages and embeds, you can use these variables:

- `{user}` - Username
- `{mention}` - User mention (@user)
- `{server}` - Server name
- `{accountAge}` - Days since account creation
- `{joinAge}` - Minutes since joining server
- `{guildMemberCount}` - Total server members
- `{verifiedRole}` - Verified role mention

**Example:**
```
Welcome {mention} to {server}! Your account is {accountAge} old.
```

---

## Troubleshooting

**Users can't verify?**
1. Check if gateway is enabled: `/gateway view`
2. Check the verification mode matches how users are trying to verify
3. Check security settings aren't too strict

**New members not getting welcome message?**
1. Ensure welcome message is enabled in configuration
2. Check if channel is accessible to the bot

**Not seeing logs?**
1. Enable logs: `/gateway logs enable [#channel]`
2. Make sure bot can post to the log channel

---

## Default Security Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Min Account Age | 3 days | Accounts must be at least this old |
| Min Join Age | 5 min | Users must wait this long after joining |
| Rate Limit | 3/min | Max 3 verification attempts per minute |
| Raid Threshold | 15/min | Lock if more than 15 attempts/min |
| Lock Duration | 10 min | How long to lock after raid detected |

---

**For detailed technical documentation, see GATEWAY_IMPLEMENTATION.md**
