import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

export const WebScraper = () => {
  const [url, setUrl] = useState('');
  const [extractType, setExtractType] = useState<'text' | 'structured' | 'links' | 'images' | 'all'>('all');
  const [customPrompt, setCustomPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [scrapedData, setScrapedData] = useState<any>(null);
  const { toast } = useToast();

  const handleScrape = async () => {
    if (!url) {
      toast({
        title: 'Error',
        description: 'Please enter a URL to scrape',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    setScrapedData(null);

    try {
      const { data, error } = await supabase.functions.invoke('scrape-website', {
        body: {
          url,
          extract_type: extractType,
          custom_prompt: customPrompt || undefined,
        },
      });

      if (error) throw error;

      if (data.success) {
        setScrapedData(data.data);
        toast({
          title: 'Success',
          description: 'Website scraped successfully',
        });
      } else {
        throw new Error(data.error || 'Failed to scrape website');
      }
    } catch (error) {
      console.error('Error scraping website:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to scrape website',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Web Scraper</CardTitle>
        <CardDescription>
          Extract information from any website using AI
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="url">Website URL</Label>
          <Input
            id="url"
            type="url"
            placeholder="https://example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={isLoading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="extract-type">Extraction Type</Label>
          <Select
            value={extractType}
            onValueChange={(value: any) => setExtractType(value)}
            disabled={isLoading}
          >
            <SelectTrigger id="extract-type">
              <SelectValue placeholder="Select extraction type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Content</SelectItem>
              <SelectItem value="text">Text Only</SelectItem>
              <SelectItem value="structured">Structured Data</SelectItem>
              <SelectItem value="links">Links</SelectItem>
              <SelectItem value="images">Images</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="custom-prompt">Custom Prompt (Optional)</Label>
          <Textarea
            id="custom-prompt"
            placeholder="Describe what specific information you want to extract..."
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            disabled={isLoading}
            rows={3}
          />
        </div>

        <Button
          onClick={handleScrape}
          disabled={isLoading || !url}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Scraping...
            </>
          ) : (
            'Scrape Website'
          )}
        </Button>

        {scrapedData && (
          <div className="space-y-2">
            <Label>Scraped Data</Label>
            <div className="rounded-md bg-muted p-4 max-h-96 overflow-auto">
              <pre className="text-sm whitespace-pre-wrap">
                {JSON.stringify(scrapedData, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
