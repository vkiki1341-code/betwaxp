import { User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useRealtimeBalance } from "@/hooks/useRealtimeBalance";

const BettingHeader = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [balance, setBalance] = useState<number>(0);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected'>('disconnected');

  useEffect(() => {
    const fetchUserAndBalance = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);
      
      // Fetch balance from Supabase
      if (data.user?.id) {
        const balanceRes = await supabase
          .from("users")
          .select("balance")
          .eq("id", data.user.id);

        if (balanceRes.data && balanceRes.data.length > 0) {
          setBalance(balanceRes.data[0].balance || 0);
        }
      }
    };
    
    fetchUserAndBalance();
  }, []);

  // Subscribe to realtime balance updates via Supabase
  const { balance: realtimeBalance, isConnected } = useRealtimeBalance({
    userId: user?.id,
    onBalanceChange: (newBalance) => {
      console.log("✨ Balance updated in real-time:", newBalance);
      setBalance(newBalance);
    },
    onError: (error) => {
      console.error("Balance subscription error:", error);
      setConnectionStatus('disconnected');
    }
  });

  // Use realtime balance if available
  useEffect(() => {
    if (realtimeBalance !== null && realtimeBalance !== undefined) {
      setBalance(realtimeBalance);
    }
  }, [realtimeBalance]);

  // Update connection status
  useEffect(() => {
    setConnectionStatus(isConnected ? 'connected' : 'disconnected');
  }, [isConnected]);

  return (
    <header className="bg-background border-b border-border p-4">
      <div className="flex items-center justify-between mb-4">
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="text-2xl font-bold">
              <span className="text-primary">Bet</span>
              <span className="text-accent">XPesa</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <div className="flex flex-col gap-1">
            <div className="border-2 border-balance-border rounded-md px-4 py-2 bg-background flex items-center gap-2">
              <span className="text-primary font-bold">💰 KES {balance.toLocaleString()}</span>
              <span className={`w-2 h-2 rounded-full ${connectionStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'}`} title={connectionStatus === 'connected' ? 'Realtime sync connected' : 'Realtime sync disconnected'}></span>
            </div>
            <span className="text-xs text-muted-foreground text-center">💱 1 USD = KES 130</span>
          </div>
          <button
            className="relative w-10 h-10 rounded-full bg-accent flex items-center justify-center text-foreground font-bold focus:outline-none focus:ring-2 focus:ring-primary/50 hover:scale-105 transition"
            onClick={() => navigate(user ? "/account" : "/login")}
            title={user ? "Account" : "Login"}
            aria-label={user ? "Account" : "Login"}
          >
            {user ? (
              <Avatar>
                <AvatarImage src={user.user_metadata?.avatar_url} alt={user.email || "User"} />
                <AvatarFallback>{user.email ? user.email[0].toUpperCase() : <User className="w-5 h-5" />}</AvatarFallback>
              </Avatar>
            ) : (
              <User className="w-6 h-6" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};

export default BettingHeader;
