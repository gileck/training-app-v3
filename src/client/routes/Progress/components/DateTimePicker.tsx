import { useState } from 'react';
import { Calendar, ChevronRight } from 'lucide-react';

export interface DateTimePickerProps {
    selectedDate: Date;
    onDateChange: (date: Date) => void;
}

export function DateTimePicker({
    selectedDate,
    onDateChange,
}: DateTimePickerProps) {
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state
    const [activeTab, setActiveTab] = useState<'date' | 'time'>('date');
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state
    const [viewMonth, setViewMonth] = useState(() => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1).getDay();

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'];
    const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

    const handleDayClick = (day: number) => {
        const newDate = new Date(selectedDate);
        newDate.setFullYear(viewMonth.getFullYear());
        newDate.setMonth(viewMonth.getMonth());
        newDate.setDate(day);
        onDateChange(newDate);
    };

    const handleQuickDate = (date: Date) => {
        const newDate = new Date(selectedDate);
        newDate.setFullYear(date.getFullYear());
        newDate.setMonth(date.getMonth());
        newDate.setDate(date.getDate());
        onDateChange(newDate);
        setViewMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    };

    const handleHourChange = (hour: number) => {
        const newDate = new Date(selectedDate);
        newDate.setHours(hour);
        onDateChange(newDate);
    };

    const handleMinuteChange = (minute: number) => {
        const newDate = new Date(selectedDate);
        newDate.setMinutes(minute);
        onDateChange(newDate);
    };

    const prevMonth = () => {
        setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1));
    };

    const nextMonth = () => {
        setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1));
    };

    const isToday = (day: number) => {
        return today.getDate() === day &&
               today.getMonth() === viewMonth.getMonth() &&
               today.getFullYear() === viewMonth.getFullYear();
    };

    const isSelected = (day: number) => {
        return selectedDate.getDate() === day &&
               selectedDate.getMonth() === viewMonth.getMonth() &&
               selectedDate.getFullYear() === viewMonth.getFullYear();
    };

    const formatSelectedDate = () => {
        const isSelectedToday = selectedDate.toDateString() === today.toDateString();
        const isSelectedYesterday = selectedDate.toDateString() === yesterday.toDateString();

        if (isSelectedToday) return 'Today';
        if (isSelectedYesterday) return 'Yesterday';

        return selectedDate.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
        });
    };

    const formatSelectedTime = () => {
        return selectedDate.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    };

    // Generate calendar grid
    const calendarDays = [];
    for (let i = 0; i < firstDayOfMonth; i++) {
        calendarDays.push(null);
    }
    for (let day = 1; day <= daysInMonth; day++) {
        calendarDays.push(day);
    }

    return (
        <div className="space-y-4">
            {/* Tab Switcher */}
            <div className="flex gap-2 p-1 bg-muted rounded-xl">
                <button
                    onClick={() => setActiveTab('date')}
                    className={`flex-1 py-3 px-4 rounded-lg font-medium text-sm transition-all duration-200 ${
                        activeTab === 'date'
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                    <div className="flex items-center justify-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span>{formatSelectedDate()}</span>
                    </div>
                </button>
                <button
                    onClick={() => setActiveTab('time')}
                    className={`flex-1 py-3 px-4 rounded-lg font-medium text-sm transition-all duration-200 ${
                        activeTab === 'time'
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                    <span>{formatSelectedTime()}</span>
                </button>
            </div>

            {/* Date Picker */}
            {activeTab === 'date' && (
                <div className="space-y-4">
                    {/* Quick Actions */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => handleQuickDate(today)}
                            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 ${
                                selectedDate.toDateString() === today.toDateString()
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-accent'
                            }`}
                        >
                            Today
                        </button>
                        <button
                            onClick={() => handleQuickDate(yesterday)}
                            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 ${
                                selectedDate.toDateString() === yesterday.toDateString()
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-accent'
                            }`}
                        >
                            Yesterday
                        </button>
                    </div>

                    {/* Month Navigation */}
                    <div className="flex items-center justify-between">
                        <button
                            onClick={prevMonth}
                            className="p-2 rounded-lg hover:bg-accent transition-colors"
                        >
                            <ChevronRight className="h-5 w-5 rotate-180" />
                        </button>
                        <span className="font-semibold text-foreground">
                            {monthNames[viewMonth.getMonth()]} {viewMonth.getFullYear()}
                        </span>
                        <button
                            onClick={nextMonth}
                            className="p-2 rounded-lg hover:bg-accent transition-colors"
                        >
                            <ChevronRight className="h-5 w-5" />
                        </button>
                    </div>

                    {/* Calendar Grid */}
                    <div className="grid grid-cols-7 gap-1">
                        {/* Day Headers */}
                        {dayNames.map((day) => (
                            <div key={day} className="h-10 flex items-center justify-center text-xs font-medium text-muted-foreground">
                                {day}
                            </div>
                        ))}

                        {/* Calendar Days */}
                        {calendarDays.map((day, index) => (
                            <div key={index} className="aspect-square">
                                {day !== null && (
                                    <button
                                        onClick={() => handleDayClick(day)}
                                        className={`w-full h-full rounded-xl text-sm font-medium transition-all duration-200 flex items-center justify-center ${
                                            isSelected(day)
                                                ? 'bg-primary text-primary-foreground shadow-md'
                                                : isToday(day)
                                                ? 'bg-accent text-accent-foreground ring-2 ring-primary/30'
                                                : 'hover:bg-accent text-foreground'
                                        }`}
                                    >
                                        {day}
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Time Picker */}
            {activeTab === 'time' && (
                <div className="py-4">
                    <div className="flex items-center justify-center gap-4">
                        {/* Hour Picker */}
                        <div className="flex flex-col items-center">
                            <span className="text-xs text-muted-foreground mb-2 font-medium">Hour</span>
                            <div className="relative h-[180px] w-16 overflow-hidden rounded-xl bg-muted">
                                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-12 bg-primary/10 border-y border-primary/20 pointer-events-none z-10" />
                                <div
                                    className="absolute inset-0 overflow-y-auto scrollbar-hide py-[66px]"
                                    style={{ scrollSnapType: 'y mandatory' }}
                                >
                                    {Array.from({ length: 24 }, (_, i) => (
                                        <button
                                            key={i}
                                            onClick={() => handleHourChange(i)}
                                            className={`w-full h-12 flex items-center justify-center text-lg font-semibold transition-all duration-150 ${
                                                selectedDate.getHours() === i
                                                    ? 'text-primary scale-110'
                                                    : 'text-muted-foreground hover:text-foreground'
                                            }`}
                                            style={{ scrollSnapAlign: 'center' }}
                                        >
                                            {i.toString().padStart(2, '0')}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Separator */}
                        <span className="text-3xl font-bold text-muted-foreground mt-6">:</span>

                        {/* Minute Picker */}
                        <div className="flex flex-col items-center">
                            <span className="text-xs text-muted-foreground mb-2 font-medium">Minute</span>
                            <div className="relative h-[180px] w-16 overflow-hidden rounded-xl bg-muted">
                                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-12 bg-primary/10 border-y border-primary/20 pointer-events-none z-10" />
                                <div
                                    className="absolute inset-0 overflow-y-auto scrollbar-hide py-[66px]"
                                    style={{ scrollSnapType: 'y mandatory' }}
                                >
                                    {Array.from({ length: 60 }, (_, i) => (
                                        <button
                                            key={i}
                                            onClick={() => handleMinuteChange(i)}
                                            className={`w-full h-12 flex items-center justify-center text-lg font-semibold transition-all duration-150 ${
                                                selectedDate.getMinutes() === i
                                                    ? 'text-primary scale-110'
                                                    : 'text-muted-foreground hover:text-foreground'
                                            }`}
                                            style={{ scrollSnapAlign: 'center' }}
                                        >
                                            {i.toString().padStart(2, '0')}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Current Selection Display */}
                    <div className="mt-6 text-center">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary">
                            <span className="text-sm font-medium">
                                {formatSelectedDate()} at {formatSelectedTime()}
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
