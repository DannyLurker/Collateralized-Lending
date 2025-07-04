import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const LoanSystemFactoryModule = buildModule(
  "LoanSystemFactory",
  (moduleDefinition) => {
    // Deploy LoanSystemFactory (tidak perlu parameter constructor)
    const loanSystemFactory = moduleDefinition.contract(
      "LoanSystemFactory",
      [], // Array kosong karena tidak ada parameter constructor
      {}
    );

    return { loanSystemFactory };
  }
);

export default LoanSystemFactoryModule;
