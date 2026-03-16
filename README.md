## Backend Plan

1. Search user by userCode API (GET /users/search/:userCode)

2. Check block status when searching users

3. Create conversation if it does not exist

4. Generate anonymous aliases (AnonXXXX) for both users

5. Fetch existing conversation when opening chat

6. Load messages for a conversation (sorted by timestamp)

7. Implement message sending API (respect 30 message limit)

8. Integrate Socket.IO for real-time messaging

9. Emit and receive new messages via sockets

10. Update unread message count

11. Mark messages as read when chat is opened

12. Implement block user API

13. Prevent messaging/search if blocked

14. Add basic authentication middleware for protected routes

15. Add input validation and security checks

16. Prepare APIs for frontend integration