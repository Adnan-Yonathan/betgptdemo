import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ScrapeRequest {
  url: string;
  extract_type?: 'text' | 'structured' | 'links' | 'images' | 'all';
  custom_prompt?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const { url, extract_type = 'all', custom_prompt }: ScrapeRequest = await req.json();

    if (!url) {
      throw new Error('URL is required');
    }

    console.log(`Scraping website: ${url} with extract_type: ${extract_type}`);

    // Build the prompt based on extraction type
    let prompt = `You are a web scraping expert. Extract information from the following website: ${url}\n\n`;

    if (custom_prompt) {
      prompt += custom_prompt;
    } else {
      switch (extract_type) {
        case 'text':
          prompt += 'Extract all readable text content from the page, organized by sections.';
          break;
        case 'structured':
          prompt += 'Extract structured data like tables, lists, and data points in a organized JSON format.';
          break;
        case 'links':
          prompt += 'Extract all links from the page with their text and href attributes.';
          break;
        case 'images':
          prompt += 'Extract all images from the page with their src, alt text, and context.';
          break;
        case 'all':
          prompt += `Extract comprehensive information from this webpage including:
1. Main content and text (organized by sections)
2. Key data points and statistics
3. Important links
4. Images with context
5. Any structured data (tables, lists)
6. Meta information (title, description)

Return the data in a well-organized JSON format.`;
          break;
      }
    }

    prompt += '\n\nReturn the extracted data in valid JSON format with clear structure.';

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a web scraping assistant that extracts and structures data from websites. Always return valid JSON with the extracted information organized clearly.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' }
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      throw new Error(`OpenAI API error: ${openaiResponse.status} - ${errorText}`);
    }

    const openaiData = await openaiResponse.json();
    const content = openaiData.choices[0].message.content;
    const scrapedData = JSON.parse(content);

    console.log(`Successfully scraped data from ${url}`);

    // Store the scraped data in the database
    const { data: savedData, error: saveError } = await supabase
      .from('scraped_websites')
      .insert({
        url: url,
        extract_type: extract_type,
        scraped_data: scrapedData,
        custom_prompt: custom_prompt
      })
      .select()
      .single();

    if (saveError) {
      console.error('Error saving scraped data:', saveError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        url: url,
        extract_type: extract_type,
        data: scrapedData,
        saved_id: savedData?.id
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error) {
    console.error('Error scraping website:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({
        error: errorMessage,
        success: false
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
