# Stacks Crowdfunding DApp - Hackathon Edition 🚀

## 🎯 **What is this project?**

A **decentralized crowdfunding platform** built on the **Stacks blockchain** that brings transparent, secure fundraising to Bitcoin's ecosystem. This hackathon-ready prototype demonstrates how smart contracts can revolutionize crowdfunding with built-in escrow, automatic refunds, and goal-based fund release.

### **Core Features:**
- 🎯 **Goal-based Funding**: Set STX fundraising targets with automatic success/failure logic
- ⏰ **Deadline Management**: Time-bound campaigns with built-in expiration
- 🔒 **Escrow Security**: Funds locked in smart contract until goal reached
- 💰 **Automatic Refunds**: Contributors get money back if campaign fails
- 🎉 **Real-time Progress**: Live updates with celebration effects
- 🛡️ **Owner Controls**: Secure withdrawal only when conditions met

## 🌟 **Why this matters?**

### **Traditional Crowdfunding Problems:**
- ❌ **Centralized Control**: Platforms can freeze or manipulate funds
- ❌ **High Fees**: 5-10% platform fees eat into funding
- ❌ **Opaque Processes**: Contributors can't verify fund handling
- ❌ **Geographic Restrictions**: Limited global accessibility
- ❌ **Trust Issues**: Rely on platform's reputation and policies

### **Our Blockchain Solution:**
- ✅ **Transparent & Trustless**: All transactions visible on-chain
- ✅ **Automated Execution**: Smart contracts handle fund management
- ✅ **Global Access**: Anyone with STX can contribute worldwide
- ✅ **Lower Fees**: Only network transaction fees (~$0.50)
- ✅ **Bitcoin Security**: Leverages Bitcoin's security via Stacks
- ✅ **Immutable Rules**: Campaign logic can't be changed after deployment

## 🛠️ **Tech Stack**

### **Blockchain Layer:**
- **Stacks Blockchain**: Bitcoin-secured smart contract platform
- **Clarity Language**: Secure, decidable smart contract language
- **Clarinet**: Development environment and testing framework

### **Frontend Stack:**
- **Next.js 14**: React framework with App Router
- **React 18**: Modern UI library with hooks
- **TypeScript**: Type-safe JavaScript
- **TailwindCSS**: Utility-first CSS framework
- **Lucide React**: Beautiful SVG icon library
- **React Confetti**: Celebration animations

## 🎪 **Hackathon Focus**

This project is specifically designed for **hackathon presentations** and **live demos**:

- 🖥️ **Local Development Only**: Runs entirely on Clarinet devnet
- ⚡ **Quick Setup**: Single command to get everything running
- 🎭 **Compelling Demo Flow**: Clear user journey from contribution to withdrawal
- 🎨 **Visual Appeal**: Confetti animations, progress bars, smooth transitions
- 📊 **Live Updates**: Real-time state changes during demo

## 🏁 **Getting Started**

```bash
# Install dependencies
npm install

# Start Clarinet devnet
cd contracts && clarinet integrate

# Launch frontend (new terminal)
npm run dev

# Run tests
npm test
```

## 🎯 **Demo Commands**

```bash
# Test contract in console
clarinet console
(contract-call? .crowdfunding contribute u5000000)  # 5 STX
(contract-call? .crowdfunding get-campaign-status)

# View in browser
open http://localhost:3000
```

---

*Built with ❤️ for the blockchain community. Ready to fund the future on Bitcoin!* 🚀