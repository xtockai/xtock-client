import { SignUp } from "@clerk/nextjs";

export default function Page() {
  return (
    <div className="h-screen">
      <div className="md:hidden h-full bg-cover bg-center flex justify-center items-center py-24" style={{ backgroundImage: 'url(/images/login-background4.jpg)' }}>
        <SignUp routing="hash" />
      </div>
      <div className="hidden md:flex h-full">
        <div className="w-1/2 bg-cover bg-center" style={{ backgroundImage: 'url(/images/login-background4.jpg)', boxShadow: '10px 0 20px rgba(0,0,0,0.3)' }}></div>
        <div className="w-1/2 flex justify-center items-center py-24">
          <SignUp routing="hash" />
        </div>
      </div>
    </div>
  );
}