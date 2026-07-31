"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Calendar, MapPin, CreditCard, CheckCircle, ChefHat, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createBooking } from "@/services/bookings";
// import { Button } from "@/components/ui/button";
// import { Textarea } from "@/components/ui/textarea";
import toast from "react-hot-toast";
import { Textarea } from "../ui/Textarea";
import { Button } from "../ui/Button";

interface BookingModalProps {
    isOpen: boolean;
    onClose: () => void;
    cook: {
        id: string;
        full_name: string;
        avatar_url?: string;
        daily_specials?: Array<{
            id: string;
            title: string;
            description: string;
            price: number;
            image_url?: string;
        }>;
        price_min?: number;
        price_max?: number;
    };
    matchId: string;
    buyerId: string;
}

type BookingStep = "meal" | "details" | "payment" | "success";

export function BookingModal({ isOpen, onClose, cook, matchId, buyerId }: BookingModalProps) {
    const [step, setStep] = useState<BookingStep>("meal");
    const [selectedMeal, setSelectedMeal] = useState<string | "custom">("custom");
    const [customMeal, setCustomMeal] = useState("");
    const [deliveryTime, setDeliveryTime] = useState("");
    const [address, setAddress] = useState("");
    const [notes, setNotes] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);
    const [buyerEmail, setBuyerEmail] = useState("");

    // Get email from AUTH (not profile table)
    useEffect(() => {
        if (!isOpen) return;
        const getEmail = async () => {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (user?.email) setBuyerEmail(user.email);
        };
        getEmail();
    }, [isOpen]);

    const selectedSpecial = cook.daily_specials?.find((s) => s.id === selectedMeal);
    const price = selectedSpecial?.price || cook.price_min || 0;

    const handlePaystackPayment = async () => {
        if (!buyerEmail) {
            toast.error("Please sign in to complete booking");
            return;
        }
        if (!buyerId) {
            toast.error("User ID missing. Please refresh.");
            return;
        }

        setIsProcessing(true);
        try {
            const mealTitle = selectedMeal === "custom" ? customMeal : selectedSpecial?.title || "Custom Meal";

            const booking = await createBooking({
                match_id: matchId,
                cook_id: cook.id,
                buyer_id: buyerId,
                dish_title: mealTitle,
                price,
                scheduled_for: deliveryTime ? new Date(deliveryTime).toISOString() : null,
                status: "pending",
            });

            const res = await fetch("/api/payments/initialize", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: buyerEmail,
                    amount: price * 100,
                    metadata: { booking_id: booking.id, cook_id: cook.id, buyer_id: buyerId },
                }),
            });

            const data = await res.json();
            if (data.authorization_url) {
                window.location.href = data.authorization_url;
            } else {
                throw new Error(data.error || "Failed to initialize payment");
            }
        } catch (err: any) {
            toast.error(err.message || "Payment failed. Please try again.");
            setIsProcessing(false);
        }
    };

    const resetAndClose = () => {
        setStep("meal");
        setSelectedMeal("custom");
        setCustomMeal("");
        setDeliveryTime("");
        setAddress("");
        setNotes("");
        setIsProcessing(false);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4"
                onClick={resetAndClose}
            >
                <motion.div
                    initial={{ y: "100%" }}
                    animate={{ y: 0 }}
                    exit={{ y: "100%" }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    className="w-full sm:max-w-md bg-[var(--bg)] border border-[var(--border)] sm:rounded-3xl rounded-t-3xl max-h-[90vh] overflow-y-auto shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="sticky top-0 bg-[var(--bg)]/95 backdrop-blur-xl border-b border-[var(--border)] px-5 py-4 flex items-center justify-between z-10">
                        <div className="flex items-center gap-2">
                            <ChefHat className="w-5 h-5 text-[var(--primary)]" />
                            <h2 className="text-lg font-bold text-[var(--text)]">Book with {cook.full_name}</h2>
                        </div>
                        <button onClick={resetAndClose} className="p-2 rounded-full hover:bg-[var(--bg-2)] transition-colors" aria-label="Close">
                            <X className="w-5 h-5 text-[var(--text-muted)]" />
                        </button>
                    </div>

                    <div className="p-5">
                        <AnimatePresence mode="wait">
                            {step === "meal" && (
                                <motion.div key="meal" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                                    <p className="text-sm text-[var(--text-muted)]">What would you like to order?</p>
                                    {cook.daily_specials && cook.daily_specials.length > 0 && (
                                        <div className="space-y-2">
                                            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Today's Specials</p>
                                            {cook.daily_specials.map((special) => (
                                                <button key={special.id} onClick={() => setSelectedMeal(special.id)}
                                                    className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${selectedMeal === special.id ? "border-[var(--primary)] bg-[var(--primary)]/10" : "border-[var(--border)] hover:border-[var(--primary)]/50"}`}>
                                                    {special.image_url ? (
                                                        // eslint-disable-next-line @next/next/no-img-element
                                                        <img src={special.image_url} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                                                    ) : (
                                                        <div className="w-12 h-12 rounded-lg bg-[var(--bg-2)] flex items-center justify-center flex-shrink-0">
                                                            <ChefHat className="w-5 h-5 text-[var(--text-muted)]" />
                                                        </div>
                                                    )}
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-medium text-sm text-[var(--text)]">{special.title}</p>
                                                        <p className="text-xs text-[var(--text-muted)] line-clamp-1">{special.description}</p>
                                                    </div>
                                                    <span className="font-bold text-[var(--primary)] text-sm flex-shrink-0">₦{special.price.toLocaleString()}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    <button onClick={() => setSelectedMeal("custom")}
                                        className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${selectedMeal === "custom" ? "border-[var(--primary)] bg-[var(--primary)]/10" : "border-[var(--border)] hover:border-[var(--primary)]/50"}`}>
                                        <div className="w-12 h-12 rounded-lg bg-[var(--bg-2)] flex items-center justify-center flex-shrink-0 text-lg">✍️</div>
                                        <div className="flex-1">
                                            <p className="font-medium text-sm text-[var(--text)]">Custom Request</p>
                                            <p className="text-xs text-[var(--text-muted)]">Describe what you want</p>
                                        </div>
                                    </button>

                                    <AnimatePresence>
                                        {selectedMeal === "custom" && (
                                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                                                <Textarea placeholder="e.g., Jollof rice with grilled chicken..." value={customMeal} onChange={(e) => setCustomMeal(e.target.value)} className="mt-2" />
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    <Button onClick={() => setStep("details")} disabled={selectedMeal === "custom" && !customMeal.trim()}
                                        className="w-full bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-white h-12 rounded-xl font-semibold">
                                        Continue
                                    </Button>
                                </motion.div>
                            )}

                            {step === "details" && (
                                <motion.div key="details" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                                            <Calendar className="w-3.5 h-3.5" /> Delivery Time
                                        </label>
                                        <input type="datetime-local" value={deliveryTime} onChange={(e) => setDeliveryTime(e.target.value)}
                                            className="w-full h-12 px-4 rounded-xl border border-[var(--border)] bg-[var(--bg-2)] text-[var(--text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                                            <MapPin className="w-3.5 h-3.5" /> Delivery Address
                                        </label>
                                        <Textarea value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Enter your delivery address..." rows={3} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Special Requests</label>
                                        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any allergies, spice level..." rows={2} />
                                    </div>
                                    <div className="flex gap-3 pt-2">
                                        <Button variant="outline" onClick={() => setStep("meal")} className="flex-1 h-12 rounded-xl border-[var(--border)] text-[var(--text)] hover:bg-[var(--bg-2)]">Back</Button>
                                        <Button onClick={() => setStep("payment")} disabled={!address.trim()} className="flex-1 bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-white h-12 rounded-xl font-semibold">Review Order</Button>
                                    </div>
                                </motion.div>
                            )}

                            {step === "payment" && (
                                <motion.div key="payment" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                                    <div className="bg-[var(--bg-2)] rounded-2xl p-5 space-y-4 border border-[var(--border)]">
                                        <div className="flex justify-between items-center pb-3 border-b border-[var(--border)]">
                                            <span className="text-sm text-[var(--text-muted)]">Meal</span>
                                            <span className="font-medium text-sm text-[var(--text)] text-right max-w-[60%]">{selectedMeal === "custom" ? customMeal : selectedSpecial?.title}</span>
                                        </div>
                                        <div className="flex justify-between items-center pb-3 border-b border-[var(--border)]">
                                            <span className="text-sm text-[var(--text-muted)]">Chef</span>
                                            <span className="font-medium text-sm text-[var(--text)]">{cook.full_name}</span>
                                        </div>
                                        <div className="flex justify-between items-center pb-3 border-b border-[var(--border)]">
                                            <span className="text-sm text-[var(--text-muted)]">Delivery</span>
                                            <span className="font-medium text-sm text-[var(--text)] text-right max-w-[60%]">{address}</span>
                                        </div>
                                        {notes && (
                                            <div className="flex justify-between items-start pb-3 border-b border-[var(--border)]">
                                                <span className="text-sm text-[var(--text-muted)]">Notes</span>
                                                <span className="font-medium text-sm text-[var(--text)] text-right max-w-[60%]">{notes}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between items-center pt-1">
                                            <span className="font-bold text-[var(--text)]">Total</span>
                                            <span className="font-bold text-2xl text-[var(--primary)]">₦{price.toLocaleString()}</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-3 pt-2">
                                        <Button variant="outline" onClick={() => setStep("details")} className="flex-1 h-12 rounded-xl border-[var(--border)] text-[var(--text)] hover:bg-[var(--bg-2)]">Back</Button>
                                        <Button onClick={handlePaystackPayment} disabled={isProcessing} className="flex-1 bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-white h-12 rounded-xl font-semibold">
                                            {isProcessing ? (
                                                <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Processing...</span>
                                            ) : (
                                                <span className="flex items-center justify-center gap-2"><CreditCard className="w-4 h-4" /> Pay Now</span>
                                            )}
                                        </Button>
                                    </div>
                                </motion.div>
                            )}

                            {step === "success" && (
                                <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-5 py-8">
                                    <div className="w-20 h-20 bg-[var(--success)]/20 rounded-full flex items-center justify-center mx-auto">
                                        <CheckCircle className="w-10 h-10 text-[var(--success)]" />
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-bold text-[var(--text)] mb-1">Booking Confirmed!</h3>
                                        <p className="text-sm text-[var(--text-muted)] max-w-xs mx-auto">{cook.full_name} has been notified. You'll receive a confirmation once they accept.</p>
                                    </div>
                                    <Button onClick={resetAndClose} className="bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-white h-12 px-8 rounded-xl font-semibold">Back to Chat</Button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}