// scripts/test-basic-tier.js
// Script to temporarily set a restaurant to Basic tier for testing

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function setRestaurantToBasicTier() {
  try {
    // Get all restaurants
    const { data: restaurants, error: fetchError } = await supabase
      .from('restaurants')
      .select('id, name, tier')
      .limit(10)

    if (fetchError) {
      console.error('Error fetching restaurants:', fetchError)
      return
    }

    console.log('Available restaurants:')
    restaurants.forEach((restaurant, index) => {
      console.log(`${index + 1}. ${restaurant.name} (ID: ${restaurant.id}) - Current tier: ${restaurant.tier || 'pro'}`)
    })

    if (restaurants.length === 0) {
      console.log('No restaurants found')
      return
    }

    // Set the first restaurant to Basic tier for testing
    const testRestaurant = restaurants[0]
    
    const { error: updateError } = await supabase
      .from('restaurants')
      .update({ tier: 'basic' })
      .eq('id', testRestaurant.id)

    if (updateError) {
      console.error('Error updating restaurant tier:', updateError)
      return
    }

    console.log(`\n✅ Successfully set restaurant "${testRestaurant.name}" to Basic tier for testing`)
    console.log(`Restaurant ID: ${testRestaurant.id}`)
    console.log('\nTo revert back to Pro tier, run:')
    console.log(`UPDATE restaurants SET tier = 'pro' WHERE id = '${testRestaurant.id}';`)

  } catch (error) {
    console.error('Unexpected error:', error)
  }
}

// To revert a restaurant back to Pro tier
async function setRestaurantToProTier(restaurantId) {
  try {
    const { error } = await supabase
      .from('restaurants')
      .update({ tier: 'pro' })
      .eq('id', restaurantId)

    if (error) {
      console.error('Error updating restaurant tier:', error)
      return
    }

    console.log(`✅ Successfully set restaurant to Pro tier`)
  } catch (error) {
    console.error('Unexpected error:', error)
  }
}

// Check command line arguments
const command = process.argv[2]
const restaurantId = process.argv[3]

if (command === 'basic') {
  setRestaurantToBasicTier()
} else if (command === 'pro' && restaurantId) {
  setRestaurantToProTier(restaurantId)
} else {
  console.log('Usage:')
  console.log('  node scripts/test-basic-tier.js basic    # Set first restaurant to basic tier')
  console.log('  node scripts/test-basic-tier.js pro <restaurant-id>    # Set specific restaurant to pro tier')
}
