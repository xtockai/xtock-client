-- Add new columns to locations table
ALTER TABLE public.locations 
ADD COLUMN restaurant_type TEXT,
ADD COLUMN restaurant_size TEXT,
ADD COLUMN cuisine_type TEXT;

-- Add check constraints for valid values
ALTER TABLE public.locations 
ADD CONSTRAINT check_restaurant_type 
CHECK (restaurant_type IN ('fast_food', 'casual_dining', 'fine_dining', 'cafe', 'food_truck', 'bakery', 'bar', 'other'));

ALTER TABLE public.locations 
ADD CONSTRAINT check_restaurant_size 
CHECK (restaurant_size IN ('small', 'medium', 'large'));

ALTER TABLE public.locations 
ADD CONSTRAINT check_cuisine_type 
CHECK (cuisine_type IN ('italian', 'mexican', 'american', 'asian', 'indian', 'mediterranean', 'french', 'japanese', 'chinese', 'thai', 'vietnamese', 'korean', 'greek', 'spanish', 'brazilian', 'peruvian', 'colombian', 'fusion', 'international', 'other'));

-- Add comments to describe the columns
COMMENT ON COLUMN public.locations.restaurant_type IS 'Type: fast_food, casual_dining, fine_dining, cafe, etc.';
COMMENT ON COLUMN public.locations.restaurant_size IS 'Size: small, medium, large';
COMMENT ON COLUMN public.locations.cuisine_type IS 'Cuisine: italian, mexican, american, asian, etc.';