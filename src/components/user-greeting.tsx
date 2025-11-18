
"use client";

import { useState, useEffect, useCallback } from 'react';
import { getWeatherData } from '@/app/actions';
import { LoaderCircle, Sun, Cloudy, CloudRain, Snowflake, MapPinOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSettings } from '@/lib/hooks/use-settings';
import { useIsMobile } from '@/hooks/use-mobile';

type WeatherData = {
  temp_F: string;
  temp_C: string;
  weatherDesc: [{ value: string }];
  weatherCode: string;
};

const weatherIcons: { [code: string]: React.ElementType } = {
    '113': Sun, // Clear/Sunny
    '116': Cloudy, // Partly cloudy
    '119': Cloudy, // Cloudy
    '122': Cloudy, // Overcast
    '176': CloudRain, // Patchy rain possible
    '266': CloudRain, // Light drizzle
    '296': CloudRain, // Light rain
    '302': CloudRain, // Moderate rain
    '308': CloudRain, // Heavy rain
    '320': Snowflake, // Light sleet
    '332': Snowflake, // Moderate or heavy snow
    '338': Snowflake, // Heavy snow
    '353': CloudRain, // Light rain shower
};

const getWeatherIcon = (weatherCode: string) => {
    return weatherIcons[weatherCode] || Sun;
};


export function UserGreeting() {
  const [greeting, setGreeting] = useState('');
  const [currentDate, setCurrentDate] = useState('');
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [isLoadingWeather, setIsLoadingWeather] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);
  const { settings } = useSettings();
  const isMobile = useIsMobile();

  useEffect(() => {
    const updateGreeting = () => {
      const hours = new Date().getHours();
      if (hours < 12) setGreeting('Good Morning!');
      else if (hours < 18) setGreeting('Good Afternoon!');
      else setGreeting('Good Evening!');
    };

    const updateDate = () => {
      setCurrentDate(new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));
    }
    
    updateGreeting();
    updateDate();
    const greetingInterval = setInterval(updateGreeting, 60000);
    const dateInterval = setInterval(updateDate, 60000);
    
    return () => {
        clearInterval(greetingInterval);
        clearInterval(dateInterval);
    };
  }, []);

  const updateWeather = useCallback(async () => {
    if (isMobile) {
        setIsLoadingWeather(false);
        return;
    }
    setIsLoadingWeather(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const weatherData = await getWeatherData(latitude, longitude);
          setWeather(weatherData);
        } catch (e) {
          console.error("Failed to fetch weather", e);
          setWeather(null);
        } finally {
          setIsLoadingWeather(false);
        }
      },
      (error) => {
        console.error("Geolocation error:", error);
        if (error.code === error.PERMISSION_DENIED) {
            setLocationError("Location access denied.");
        } else {
            setLocationError("Location unavailable.");
        }
        setIsLoadingWeather(false);
      }
    );
  }, [isMobile]);


  useEffect(() => {
    updateWeather();
    const weatherInterval = setInterval(updateWeather, 10 * 60 * 1000); // every 10 mins
    return () => clearInterval(weatherInterval);
  }, [updateWeather]);
  
  const WeatherIcon = weather ? getWeatherIcon(weather.weatherCode) : LoaderCircle;

  return (
    <div className="text-left">
        <h2 className="text-xl font-semibold text-foreground">
            {greeting}
        </h2>
        
        <div className="mt-2 text-sm space-y-1 text-muted-foreground">
            {currentDate && <p>{currentDate}</p>}
            {!isMobile && (
              <div className={cn("flex items-center gap-2", isLoadingWeather && "opacity-50")}>
                  {isLoadingWeather ? (
                      <>
                        <LoaderCircle className="animate-spin h-4 w-4" />
                        <span>Fetching local weather...</span>
                      </>
                  ) : locationError ? (
                      <>
                        <MapPinOff className="h-4 w-4" />
                        <span>{locationError}</span>
                      </>
                  ) : (
                      weather ? (
                          <>
                              <WeatherIcon className="h-4 w-4" />
                              <span>
                                  {settings.temperatureUnit === 'celsius' ? `${weather.temp_C}°C` : `${weather.temp_F}°F`}, {weather.weatherDesc[0].value}
                              </span>
                          </>
                      ) : (
                          <span>Weather unavailable</span>
                      )
                  )}
              </div>
            )}
        </div>
    </div>
  );
}
