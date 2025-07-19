# Security Guidelines

## 🔒 **CRITICAL: Data Privacy & Security**

This extension handles sensitive meeting transcripts and requires strict adherence to data privacy principles.

### ⚠️ **NEVER COMMIT REAL DATA**

**Absolutely prohibited:**
- ❌ Real meeting transcripts from Microsoft Teams
- ❌ Actual employee names or company information  
- ❌ Genuine Stream API responses with sensitive content
- ❌ Any files containing confidential business discussions
- ❌ Real SharePoint URLs or tenant information

### ✅ **Safe for Repository**

**Only commit:**
- ✅ Anonymized test data in `/test/fixtures/`
- ✅ Fictional personas (Alice 王, Bob 李, etc.)
- ✅ Generic conversation examples about product planning
- ✅ Documentation and code without real data

## 🛡️ **Data Protection Measures**

### Git Protection
- `.gitignore` rules prevent common sensitive file patterns
- Automated protection against `Stream Content*.json` files
- Blocks files with `-real`, `-actual`, `-prod`, `-personal` suffixes

### Development Guidelines

1. **Use Test Fixtures Only**
   ```bash
   # ✅ Use provided test data
   /test/fixtures/sample-transcript.json
   
   # ❌ Never commit real data
   Stream Content.json  # Blocked by .gitignore
   ```

2. **Anonymization Checklist**
   - [ ] Replace all real names with fictional personas
   - [ ] Remove company-specific terminology
   - [ ] Replace actual conversation content with generic topics
   - [ ] Sanitize all IDs and URLs
   - [ ] Verify no personal information remains

3. **Safe Development Practices**
   ```javascript
   // ✅ Good: Use test fixtures
   const transcript = require('./test/fixtures/sample-transcript.json');
   
   // ❌ Bad: Reference real data
   const transcript = require('./Stream Content.json');
   ```

## 🔍 **Extension Security Features**

### Client-Side Processing
- All transcript processing happens locally in browser
- No external servers receive sensitive meeting data
- AI API calls include only the transcript content user chooses to send

### API Key Management
- User's API keys stored securely in Chrome's encrypted storage
- Keys never transmitted to our servers
- User maintains full control over their API credentials

### Session Security
- Uses existing Teams session authentication
- No additional login requirements
- Respects existing SharePoint permissions

## 📋 **Pre-Commit Checklist**

Before committing any code:

1. **Scan for Sensitive Data**
   ```bash
   # Check for real names or company info
   grep -r "real_name_pattern" .
   grep -r "company_specific_term" .
   ```

2. **Verify Test Data Only**
   - [ ] All test files use fictional data
   - [ ] No real meeting content in examples
   - [ ] Demo scripts use anonymized data

3. **Check File Patterns**
   - [ ] No `Stream Content*.json` files
   - [ ] No files with `-real`, `-actual`, `-personal` suffixes
   - [ ] All test fixtures properly anonymized

## 🚨 **Incident Response**

### If Real Data Was Committed

1. **Immediately remove from repository**
   ```bash
   git rm "sensitive-file.json"
   git commit -m "Remove sensitive data"
   ```

2. **Purge from Git history** (if necessary)
   ```bash
   git filter-branch --force --index-filter \
   'git rm --cached --ignore-unmatch sensitive-file.json' \
   --prune-empty --tag-name-filter cat -- --all
   ```

3. **Force push to update remote**
   ```bash
   git push origin --force --all
   ```

4. **Notify team members** to update their local repositories

### Reporting Security Issues

If you discover a security vulnerability:
1. **Do NOT create a public issue**
2. Contact maintainers privately
3. Provide detailed description of the issue
4. Allow time for fix before public disclosure

## 📚 **Compliance Notes**

- Follow your organization's data handling policies
- Ensure compliance with GDPR, CCPA, and local privacy laws
- Consider data retention policies when using AI services
- Document any data processing activities as required

## 🔧 **Security Testing**

Regular security audits should verify:
- No sensitive data in repository
- Proper anonymization of test fixtures
- Secure API key storage implementation
- Correct session handling

---

**Remember: When in doubt, err on the side of caution. It's better to over-anonymize than risk exposing sensitive information.**