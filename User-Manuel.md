User Manual: Setting Up Automatic Learning Contracts (Plain-Language Edition)
Introduction
Learning Contracts give you full control over what your AI co-worker can learn from your interactions. By default, nothing is learned unless you explicitly allow it through a contract. These contracts are written in clear, everyday language—no technical jargon required.
The system uses a powerful language model (LLM) behind the scenes to translate your plain-language instructions into precise, enforceable rules. You never need to write or see JSON; it's handled automatically in the background.
This manual shows you how to create contracts that run automatically end-to-end. Once activated, the contract quietly enforces itself during every relevant interaction—no pop-ups or per-session approvals needed (unless you specifically want them).
We'll walk through two real-world examples:

Coding – Automatically learning reusable coding tips and best practices.
Streaming Video Gameplay – Automatically capturing and recalling specific gameplay moments from your streams.

Getting Started
Access the Learning Contracts interface through:

The web dashboard (recommended for beginners)
Voice command ("Hey Assistant, let's make a learning contract")
Or typed command: create learning contract

The system will guide you conversationally using plain language.
Example 1: Automatic Contract for Coding
Goal: Allow the assistant to automatically learn and reuse helpful coding patterns (like "prefer list comprehensions in Python") while you're working on projects, without needing to approve each time.
Step 1: Start Drafting in Plain Language
Say or type:
textcreate learning contract
The assistant responds:
Great! Let's make a new Learning Contract. What should this contract be about?
You reply:
Coding and programming. I want you to learn reusable tips and best practices from my Python coding sessions.
Assistant:
Got it — this will be a "Procedural Learning" contract (for learning reusable techniques).Which tools or environments does this apply to? (e.g., Python, VS Code, Git, specific projects)
You:
Python programming in VS Code or Git. Only for my personal coding projects — not work stuff or anything with sensitive data.
Assistant:
Perfect. How long should learned tips be kept?
You:
Permanently, until I revoke the contract.
Assistant:
Should the assistant be allowed to quietly apply these tips in future coding sessions without asking you each time?
You:
Yes, as long as it's in the same kind of project.
Assistant:
One more thing: Should these learned tips ever be shared outside this system or used with other users?
You:
No, never.
Assistant:
Here's what I understand in plain language:Coding Learning Contract
You allow the assistant to observe your Python coding in personal projects (using tools like VS Code or Git). It may quietly learn and store reusable coding tips and best practices. These tips can be automatically applied in future similar sessions. They are kept permanently and never shared outside this system. No personal or sensitive data will be included. You can revoke this at any time.Does this sound right? (Yes / No / Change something)
You:
Yes
Step 2: Review and Activate
Assistant:
Contract drafted and reviewed. Ready to activate now?
Once activated, it will automatically apply during all matching coding sessions.
You:
Yes, activate it.
Assistant:
Contract activated!
You'll see it listed under "Active Contracts" in your dashboard.
You can always say "show my learning contracts" or "revoke coding contract" to manage it.
Done. From now on, whenever you're coding in Python on personal projects, the assistant will automatically learn helpful patterns and apply them in future sessions—no further input needed.
Example 2: Automatic Contract for Streaming Video Gameplay
Goal: Automatically save specific gameplay moments or strategies from your live streams (e.g., a clever Fortnite build or clutch play) for later recall, without generalization across unrelated games.
Step 1: Start Drafting
You:
textcreate learning contract
Assistant:
What should this contract be about?
You:
Streaming video gameplay. I want to save specific moments or strategies from my live game streams.
Assistant:
This sounds like an "Episodic Learning" contract — good for capturing individual events without combining them into broader rules.Which games or platforms?
You:
Fortnite streams on Twitch using OBS Studio.
Assistant:
How long should these gameplay memories be kept?
You:
About 30 days — then automatically freeze them.
Assistant:
Should the assistant combine lessons across different streams or games to create general strategies?
You:
No, keep each episode separate. No big-picture generalizations.
Assistant:
Should it ask your permission every time it wants to recall a past gameplay moment?
You:
Yes, I'd like to approve recall each time.
Assistant:
Summary in plain language:Gameplay Streaming Contract
You allow the assistant to capture and store specific moments from your Fortnite streams on Twitch (using OBS). Each moment is saved separately — no combining into general strategies. Memories are kept for 30 days, then automatically frozen. Recall requires your approval each time. Nothing is ever shared outside this system. You can revoke anytime.Look good?
You:
Yes
Step 2: Activate
You:
Activate it.
Assistant:
Contract activated! It will now automatically capture qualifying gameplay moments during streams.
Memories will auto-expire after 30 days. Say "show gameplay memories" to review them when ready.
Done. The contract now runs fully automatically: capturing episodes during streams, enforcing no generalization, auto-freezing after 30 days, and requiring your approval for recall.
Managing Your Contracts
At any time, say:

show my learning contracts → See all active and past contracts in plain language
revoke coding contract → Immediately stops learning and quarantines memories
revoke gameplay contract → Same for gameplay
pause all learning → Emergency override (human supremacy)

All actions are logged transparently, but only you can see the audit trail.
Final Note
You’re in full control. The assistant proposes contracts based on your words, but nothing happens without your final "Yes." Learning only occurs where you explicitly allow it — never by surprise.
Enjoy building trusted, automatic learning — safely and on your terms.
