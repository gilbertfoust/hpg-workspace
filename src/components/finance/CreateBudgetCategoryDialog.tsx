import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useBudgetCategories } from "@/hooks/useBudgetCategories";
import { Loader2 } from "lucide-react";

const formSchema = z.object({
  code: z.string().trim().min(1, "Code is required").max(20),
  name: z.string().trim().min(1, "Name is required").max(200),
  type: z.enum(["income", "expense", "asset", "liability", "equity"]),
});

type FormValues = z.infer<typeof formSchema>;

interface CreateBudgetCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ngoId: string;
}

export function CreateBudgetCategoryDialog({ open, onOpenChange, ngoId }: CreateBudgetCategoryDialogProps) {
  const { toast } = useToast();
  const { create } = useBudgetCategories(ngoId);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { code: "", name: "", type: "expense" },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      await create.mutateAsync({
        ngo_id: ngoId,
        code: values.code,
        name: values.name,
        type: values.type,
        is_active: true,
      });
      toast({ title: "Category created" });
      form.reset();
      onOpenChange(false);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>New Budget Category</DialogTitle>
          <DialogDescription>Add an NGO-specific category in addition to the global HPG template.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="code" render={({ field }) => (
              <FormItem>
                <FormLabel>Code</FormLabel>
                <FormControl><Input placeholder="e.g. 7100" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl><Input placeholder="e.g. Local Transport" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="type" render={({ field }) => (
              <FormItem>
                <FormLabel>Type</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="income">Income</SelectItem>
                    <SelectItem value="expense">Expense</SelectItem>
                    <SelectItem value="asset">Asset</SelectItem>
                    <SelectItem value="liability">Liability</SelectItem>
                    <SelectItem value="equity">Equity</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Create
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
