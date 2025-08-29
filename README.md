# Stacks Crowdfunding DApp 🚀

A  decentralized crowdfunding platform built on Stacks blockchain.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Docker Desktop
- Clarinet CLI (`npm install -g @hirosystems/clarinet`)

### Installation

```bash
# Install dependencies
npm install

# Start Clarinet devnet
cd contracts && clarinet integrate

# Launch frontend (new terminal)
npm run dev
```

Visit `http://localhost:3000` to see your DApp!

## 🧪 Testing

```bash
# Run contract tests
npm test

# Test in console
cd contracts && clarinet console
(contract-call? .crowdfunding contribute u5000000)
```

## 📁 Project Structure

- `/contracts/` - Clarity smart contracts and tests
- `/app/` - Next.js frontend application
- `/components/` - Reusable UI components
- `/public/` - Static assets

## 🎯 Demo Flow

1. Start local blockchain
2. Launch frontend
3. Contribute to campaign
4. Watch confetti when goal reached!
5. Withdraw or get refund

## 📚 Documentation

See `ABOUT.md` for detailed project information and technical architecture.

---

Built for hackathons with ❤️